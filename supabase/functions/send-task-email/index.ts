import { getSupabaseAdmin, requireAuthUser } from "../_shared/auth.ts";
import { isAllowedOrigin, optionsResponse } from "../_shared/cors.ts";
import { ApiError, internalError, jsonError, jsonOk } from "../_shared/responses.ts";
import { renderTaskPriorityRow } from "./priorityTemplate.ts";

interface RequestBody {
  assigneeId?: string;
  taskName?: string;
  taskDescription?: string;
  deadline?: string;
  priority?: string;
  groupName?: string;
  type?: "assigned" | "revision";
  feedback?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  if (req.method !== "POST") {
    return jsonError(req, new ApiError("not_found", "Không tìm thấy endpoint."));
  }

  if (!isAllowedOrigin(req)) {
    return jsonError(req, new ApiError("forbidden", "Origin không được phép."));
  }

  try {
    const user = await requireAuthUser(req);
    
    const body = (await req.json().catch(() => null)) as RequestBody | null;
    if (!body || !body.assigneeId || !body.taskName) {
      throw new ApiError("bad_request", "Thiếu thông tin người nhận hoặc tên nhiệm vụ.");
    }

    const { assigneeId, taskName, taskDescription, deadline, priority, groupName, type = "assigned", feedback } = body;

    const admin = getSupabaseAdmin();
    
    // Look up assignee's email and name
    const { data: assignee, error: userError } = await admin
      .from("users")
      .select("email, full_name")
      .eq("id", assigneeId)
      .single();

    if (userError || !assignee) {
      console.error("Failed to find assignee user details:", userError);
      throw new ApiError("not_found", "Không tìm thấy thông tin thành viên được giao.");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("SEND_EMAIL_FROM") || "onboarding@resend.dev";

    let emailSubject = `[Teamfair] Nhiệm vụ mới được giao / New Task Assigned: ${taskName}`;
    let emailTitle = `Nhiệm vụ mới / New Task`;
    let emailHeading = `Bạn đã được giao một nhiệm vụ mới trong nhóm <strong>${groupName || "Chưa xác định"}</strong>.`;

    if (type === "revision") {
      emailSubject = `[Teamfair] Yêu cầu chỉnh sửa nhiệm vụ / Task Revision Required: ${taskName}`;
      emailTitle = `Yêu cầu chỉnh sửa / Revision Requested`;
      emailHeading = `Nhiệm vụ của bạn trong nhóm <strong>${groupName || "Chưa xác định"}</strong> cần được chỉnh sửa theo yêu cầu của Leader.`;
    }

    let feedbackSection = "";
    if (type === "revision" && feedback) {
      feedbackSection = `
        <div style="background-color: #fef2f2; border: 1px solid #fee2e2; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
          <strong style="color: #991b1b;">Yêu cầu chỉnh sửa / Feedback:</strong>
          <p style="margin: 8px 0 0 0; color: #7f1d1d;">${feedback}</p>
        </div>
      `;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${emailTitle}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 40px auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 24px; }
          .header h2 { color: ${type === "revision" ? "#dc2626" : "#4f46e5"}; margin: 0; font-size: 24px; font-weight: 700; }
          .content { font-size: 16px; color: #334155; }
          .task-details { background-color: #f1f5f9; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0; }
          .task-row { display: flex; margin-bottom: 12px; }
          .task-row:last-child { margin-bottom: 0; }
          .task-label { font-weight: 600; width: 150px; color: #475569; shrink-0; }
          .task-value { color: #0f172a; flex: 1; }
          .footer { font-size: 13px; color: #64748b; text-align: center; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${emailTitle}</h2>
          </div>
          <div class="content">
            <p>Xin chào <strong>${assignee.full_name}</strong>,</p>
            <p>${emailHeading}</p>
            ${feedbackSection}
            <div class="task-details">
              <div class="task-row">
                <div class="task-label">Tên nhiệm vụ:</div>
                <div class="task-value"><strong>${taskName}</strong></div>
              </div>
              <div class="task-row">
                <div class="task-label">Mô tả:</div>
                <div class="task-value">${taskDescription || "<i>Không có mô tả</i>"}</div>
              </div>
              <div class="task-row">
                <div class="task-label">Hạn chót:</div>
                <div class="task-value">${deadline || "<i>Không có hạn chót</i>"}</div>
              </div>
              ${renderTaskPriorityRow(priority)}
            </div>
            <p>Vui lòng truy cập Teamfair để kiểm tra chi tiết và bắt đầu thực hiện.</p>
          </div>
          <div class="footer">
            <p>Đây là email tự động từ hệ thống Teamfair.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY is not configured. Email sending simulated.");
      return jsonOk(req, {
        simulated: true,
        recipient: assignee.email,
        subject: emailSubject,
        message: "RESEND_API_KEY is not set. Email not sent, only simulated."
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: assignee.email,
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend API error:", errorText);
      throw new ApiError("internal_error", "Không thể gửi email qua Resend.");
    }

    const data = await res.json();
    return jsonOk(req, { success: true, messageId: data.id, recipient: assignee.email });

  } catch (error) {
    if (error instanceof ApiError) return jsonError(req, error);
    console.error("send-task-email internal error:", error);
    return internalError(req);
  }
});
