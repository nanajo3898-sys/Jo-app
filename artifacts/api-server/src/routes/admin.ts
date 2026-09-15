import { Router, type IRouter, type Request, type Response } from "express";
import {
  GenerateQuestionsBody,
  GenerateQuestionsResponse,
  GetExamQuestionsResponse,
  ReorderExamQuestionsBody,
  ReorderExamQuestionsResponse,
  UpdateExamQuestionBody,
  UpdateExamQuestionResponse,
} from "@workspace/api-zod";
import { generateExamQuestions } from "../lib/groq";
import { supabaseRequest } from "../lib/supabase";

const router: IRouter = Router();

type ProfileRow = { role?: string };
type ExamRow = { id: string; title?: string | null; subject_id: string | null };
type SubjectRow = { name: string };
type StoredQuestion = {
  id: string;
  exam_id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
  order_index: number;
};

function getAccessToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function authorizeSupervisor(req: Request, res: Response): Promise<string | null> {
  const accessToken = getAccessToken(req.header("authorization"));
  if (!accessToken) {
    res.status(401).json({ error: "يجب تسجيل الدخول" });
    return null;
  }

  const user = await supabaseRequest<{ id?: string }>("/auth/v1/user", accessToken);
  if (!user.ok || !user.data?.id) {
    res.status(401).json({ error: "جلسة الدخول غير صالحة" });
    return null;
  }

  const profile = await supabaseRequest<ProfileRow[]>(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(user.data.id)}&select=role&limit=1`,
    accessToken,
  );
  if (!profile.ok) {
    res.status(500).json({ error: "تعذر التحقق من صلاحيات الحساب" });
    return null;
  }
  if (profile.data?.[0]?.role !== "supervisor") {
    res.status(403).json({ error: "غير مصرح لك بإدارة أسئلة الامتحانات" });
    return null;
  }

  return accessToken;
}

type ExamReviewPayload = {
  exam_id: string;
  exam_title: string;
  subject_name: string | null;
  questions: StoredQuestion[];
};

async function loadExamReview(accessToken: string, examId: string): Promise<{ status: number; data?: ExamReviewPayload; error?: string }> {
  const exam = await supabaseRequest<ExamRow[]>(
    `/rest/v1/exams?id=eq.${encodeURIComponent(examId)}&select=id,title,subject_id&limit=1`,
    accessToken,
  );
  if (!exam.ok) return { status: 500, error: "تعذر تحميل الامتحان" };
  const examRow = exam.data?.[0];
  if (!examRow) return { status: 404, error: "الامتحان غير موجود" };

  let subjectName: string | null = null;
  if (examRow.subject_id) {
    const subject = await supabaseRequest<SubjectRow[]>(
      `/rest/v1/subjects?id=eq.${encodeURIComponent(examRow.subject_id)}&select=name&limit=1`,
      accessToken,
    );
    if (!subject.ok) return { status: 500, error: "تعذر تحميل المادة" };
    subjectName = subject.data?.[0]?.name || null;
  }

  const questions = await supabaseRequest<StoredQuestion[]>(
    `/rest/v1/questions?exam_id=eq.${encodeURIComponent(examId)}&select=id,exam_id,question_text,options,correct_answer,explanation,order_index&order=order_index.asc,id.asc`,
    accessToken,
  );
  if (!questions.ok) return { status: 500, error: "تعذر تحميل أسئلة الامتحان" };

  return {
    status: 200,
    data: {
      exam_id: examRow.id,
      exam_title: examRow.title?.trim() || "امتحان بدون عنوان",
      subject_name: subjectName,
      questions: (questions.data || []).map((question, index) => ({
        ...question,
        order_index: Number.isInteger(question.order_index) ? question.order_index : index,
      })),
    },
  };
}

router.post("/admin/generate-questions", async (req, res): Promise<void> => {
  const accessToken = getAccessToken(req.header("authorization"));
  if (!accessToken) {
    res.status(401).json({ error: "يجب تسجيل الدخول" });
    return;
  }

  const parsed = GenerateQuestionsBody.safeParse(req.body || {});
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات توليد الأسئلة غير صالحة" });
    return;
  }

  try {
    const user = await supabaseRequest<{ id?: string }>("/auth/v1/user", accessToken);
    if (!user.ok || !user.data?.id) {
      res.status(401).json({ error: "جلسة الدخول غير صالحة" });
      return;
    }

    const profile = await supabaseRequest<ProfileRow[]>(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(user.data.id)}&select=role&limit=1`,
      accessToken,
    );
    if (!profile.ok) {
      req.log.error({ status: profile.status }, "Could not verify supervisor profile");
      res.status(500).json({ error: "تعذر التحقق من صلاحيات الحساب" });
      return;
    }
    if (profile.data?.[0]?.role !== "supervisor") {
      res.status(403).json({ error: "غير مصرح لك بتوليد الأسئلة" });
      return;
    }

    const exam = await supabaseRequest<ExamRow[]>(
      `/rest/v1/exams?id=eq.${encodeURIComponent(parsed.data.exam_id)}&select=id,subject_id&limit=1`,
      accessToken,
    );
    if (!exam.ok) {
      req.log.error({ status: exam.status }, "Could not load exam for question generation");
      res.status(500).json({ error: "تعذر تحميل الامتحان" });
      return;
    }
    const examRow = exam.data?.[0];
    if (!examRow) {
      res.status(404).json({ error: "الامتحان غير موجود" });
      return;
    }
    if (!examRow.subject_id) {
      res.status(400).json({ error: "الامتحان غير مرتبط بمادة" });
      return;
    }

    const subject = await supabaseRequest<SubjectRow[]>(
      `/rest/v1/subjects?id=eq.${encodeURIComponent(examRow.subject_id)}&select=name&limit=1`,
      accessToken,
    );
    const subjectName = subject.data?.[0]?.name?.trim();
    if (!subject.ok) {
      req.log.error({ status: subject.status }, "Could not load subject for question generation");
      res.status(500).json({ error: "تعذر تحميل المادة" });
      return;
    }
    if (!subjectName) {
      res.status(404).json({ error: "المادة غير موجودة" });
      return;
    }

    let questions;
    try {
      questions = await generateExamQuestions(subjectName, parsed.data.count, parsed.data.level);
    } catch (error) {
      req.log.error({ err: error }, "Question generation failed");
      res.status(502).json({ error: "تعذر توليد الأسئلة حالياً، حاول مرة أخرى" });
      return;
    }

    const insert = await supabaseRequest<StoredQuestion[]>(
      "/rest/v1/questions",
      accessToken,
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(
          questions.map((question, index) => ({
            exam_id: examRow.id,
            question_text: question.question_text,
            options: question.options,
            correct_answer: question.correct_answer,
            explanation: question.explanation,
            order_index: index,
          })),
        ),
      },
    );
    if (!insert.ok || !Array.isArray(insert.data) || insert.data.length !== questions.length) {
      req.log.error({ status: insert.status }, "Could not save generated questions");
      res.status(500).json({ error: "تم توليد الأسئلة لكن تعذر حفظها" });
      return;
    }

    const response = GenerateQuestionsResponse.parse({
      exam_id: examRow.id,
      inserted_count: insert.data.length,
      questions: insert.data,
    });
    res.status(201).json(response);
  } catch (error) {
    req.log.error({ err: error }, "Unexpected question generation error");
    res.status(500).json({ error: "حصل خطأ أثناء توليد الأسئلة" });
  }
});

router.get("/admin/exams/:examId/questions", async (req, res): Promise<void> => {
  try {
    const accessToken = await authorizeSupervisor(req, res);
    if (!accessToken) return;

    const review = await loadExamReview(accessToken, req.params.examId);
    if (!review.data) {
      res.status(review.status).json({ error: review.error || "تعذر تحميل أسئلة الامتحان" });
      return;
    }
    res.json(GetExamQuestionsResponse.parse(review.data));
  } catch (error) {
    req.log.error({ err: error }, "Unexpected exam question review error");
    res.status(500).json({ error: "حصل خطأ أثناء تحميل أسئلة الامتحان" });
  }
});

router.put("/admin/exams/:examId/questions", async (req, res): Promise<void> => {
  try {
    const accessToken = await authorizeSupervisor(req, res);
    if (!accessToken) return;

    const parsed = ReorderExamQuestionsBody.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: "ترتيب الأسئلة غير صالح" });
      return;
    }

    const review = await loadExamReview(accessToken, req.params.examId);
    if (!review.data) {
      res.status(review.status).json({ error: review.error || "تعذر تحميل أسئلة الامتحان" });
      return;
    }

    const requestedIds = parsed.data.question_ids;
    const existingIds = review.data.questions.map((question) => question.id);
    if (
      requestedIds.length !== existingIds.length ||
      new Set(requestedIds).size !== requestedIds.length ||
      requestedIds.some((id) => !existingIds.includes(id))
    ) {
      res.status(400).json({ error: "يجب إرسال جميع أسئلة الامتحان مرة واحدة وبترتيب صحيح" });
      return;
    }

    for (const [orderIndex, questionId] of requestedIds.entries()) {
      const update = await supabaseRequest(
        `/rest/v1/questions?id=eq.${encodeURIComponent(questionId)}&exam_id=eq.${encodeURIComponent(req.params.examId)}`,
        accessToken,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ order_index: orderIndex }),
        },
      );
      if (!update.ok) {
        req.log.error({ status: update.status, questionId }, "Could not save question order");
        res.status(500).json({ error: "تعذر حفظ ترتيب الأسئلة" });
        return;
      }
    }

    const updatedReview = await loadExamReview(accessToken, req.params.examId);
    if (!updatedReview.data) {
      res.status(updatedReview.status).json({ error: updatedReview.error || "تعذر تحميل أسئلة الامتحان" });
      return;
    }
    res.json(ReorderExamQuestionsResponse.parse(updatedReview.data));
  } catch (error) {
    req.log.error({ err: error }, "Unexpected question reorder error");
    res.status(500).json({ error: "حصل خطأ أثناء حفظ ترتيب الأسئلة" });
  }
});

router.patch("/admin/exams/:examId/questions/:questionId", async (req, res): Promise<void> => {
  try {
    const accessToken = await authorizeSupervisor(req, res);
    if (!accessToken) return;

    const parsed = UpdateExamQuestionBody.safeParse(req.body || {});
    if (!parsed.success) {
      res.status(400).json({ error: "بيانات السؤال غير صالحة" });
      return;
    }

    const questionText = parsed.data.question_text.trim();
    const options = parsed.data.options.map((option) => option.trim());
    const correctAnswer = parsed.data.correct_answer.trim();
    const explanation = parsed.data.explanation?.trim() || null;
    if (
      !questionText ||
      options.some((option) => !option) ||
      new Set(options).size !== options.length ||
      !options.includes(correctAnswer)
    ) {
      res.status(400).json({ error: "يجب أن تكون الخيارات مختلفة وأن تطابق الإجابة الصحيحة أحدها" });
      return;
    }

    const existing = await supabaseRequest<StoredQuestion[]>(
      `/rest/v1/questions?id=eq.${encodeURIComponent(req.params.questionId)}&exam_id=eq.${encodeURIComponent(req.params.examId)}&select=id,exam_id,question_text,options,correct_answer,explanation,order_index&limit=1`,
      accessToken,
    );
    if (!existing.ok) {
      res.status(500).json({ error: "تعذر تحميل السؤال" });
      return;
    }
    if (!existing.data?.[0]) {
      res.status(404).json({ error: "السؤال غير موجود في هذا الامتحان" });
      return;
    }

    const update = await supabaseRequest<StoredQuestion[]>(
      `/rest/v1/questions?id=eq.${encodeURIComponent(req.params.questionId)}&exam_id=eq.${encodeURIComponent(req.params.examId)}`,
      accessToken,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          question_text: questionText,
          options,
          correct_answer: correctAnswer,
          explanation,
        }),
      },
    );
    if (!update.ok || !update.data?.[0]) {
      req.log.error({ status: update.status }, "Could not update exam question");
      res.status(500).json({ error: "تعذر حفظ تعديلات السؤال" });
      return;
    }
    res.json(UpdateExamQuestionResponse.parse(update.data[0]));
  } catch (error) {
    req.log.error({ err: error }, "Unexpected exam question update error");
    res.status(500).json({ error: "حصل خطأ أثناء حفظ تعديلات السؤال" });
  }
});

router.delete("/admin/exams/:examId/questions/:questionId", async (req, res): Promise<void> => {
  try {
    const accessToken = await authorizeSupervisor(req, res);
    if (!accessToken) return;

    const existing = await supabaseRequest<{ id: string }[]>(
      `/rest/v1/questions?id=eq.${encodeURIComponent(req.params.questionId)}&exam_id=eq.${encodeURIComponent(req.params.examId)}&select=id&limit=1`,
      accessToken,
    );
    if (!existing.ok) {
      res.status(500).json({ error: "تعذر تحميل السؤال" });
      return;
    }
    if (!existing.data?.[0]) {
      res.status(404).json({ error: "السؤال غير موجود في هذا الامتحان" });
      return;
    }

    const deleted = await supabaseRequest(
      `/rest/v1/questions?id=eq.${encodeURIComponent(req.params.questionId)}&exam_id=eq.${encodeURIComponent(req.params.examId)}`,
      accessToken,
      { method: "DELETE", headers: { Prefer: "return=minimal" } },
    );
    if (!deleted.ok) {
      if (deleted.status === 404) {
        res.status(404).json({ error: "السؤال غير موجود في هذا الامتحان" });
        return;
      }
      req.log.error({ status: deleted.status }, "Could not delete exam question");
      res.status(500).json({ error: "تعذر حذف السؤال" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    req.log.error({ err: error }, "Unexpected exam question delete error");
    res.status(500).json({ error: "حصل خطأ أثناء حذف السؤال" });
  }
});

export default router;