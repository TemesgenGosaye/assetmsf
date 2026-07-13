/**
 * Email Service for SAMS
 * Handles sending emails via SMTP with beautiful templates
 */

import { djangoRequest } from "./djangoAuth";
import {
  approvalSubmittedTemplate,
  approvalForwardedTemplate,
  approvalApprovedTemplate,
  approvalRejectedTemplate,
  newsletterPublishedTemplate,
  ticketAssignedTemplate,
  ticketStatusUpdateTemplate,
  auditStartedTemplate,
  auditSubmittedTemplate,
  welcomeEmailTemplate,
  passwordResetTemplate,
  passwordResetOtpTemplate,
  type EmailTemplate,
} from "./emailTemplates";

export interface EmailConfig {
  enabled: boolean;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

// Get email configuration from environment or settings
export function getEmailConfig(): EmailConfig | null {
  // Primary flag from build-time env; server can override at runtime
  const clientEnabled = import.meta.env.VITE_EMAIL_ENABLED !== "false";
  if (!clientEnabled) return null;
  // Edge Function handles all delivery via Resend; no client config needed
  return { enabled: true };
}

// Get dashboard URL for email links
function getDashboardUrl(): string {
  return import.meta.env.VITE_DASHBOARD_URL || 'https://samsproject.in';
}

/**
 * Send email via Supabase Edge Function
 * This calls a backend function to handle actual email sending
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const config = getEmailConfig();
  
  if (!config || !config.enabled) {
    console.log("Email not enabled, skipping send:", params.subject);
    return false;
  }

  try {
    // Resolve API endpoint (supports local dev without vercel dev via fallback)
    const primaryUrl = (import.meta.env as any).VITE_EMAIL_API_URL || "/api/send-email";
    const doPost = async (url: string) => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: Array.isArray(params.to) ? params.to : [params.to],
        cc: params.cc ? (Array.isArray(params.cc) ? params.cc : [params.cc]) : undefined,
        bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc : [params.bcc]) : undefined,
        subject: params.subject,
        html: params.html,
        text: params.text,
        replyTo: params.replyTo,
      }),
    });

    let resp = await doPost(primaryUrl);
    // Fallback: if local vite dev (no /api), try deployed domain if available
    if (resp.status === 404 || resp.status === 405) {
      const dash = (import.meta.env as any).VITE_DASHBOARD_URL as string | undefined;
      if (dash && primaryUrl.startsWith("/")) {
        try { resp = await doPost(dash.replace(/\/$/, "") + "/api/send-email"); } catch {}
      }
    }

    if (!resp.ok) {
      return false;
    }
    const data = await resp.json();
    if (data?.skipped) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if user has email notifications enabled
 */
async function shouldSendEmailToUser(userId: string): Promise<boolean> {
  try {
    const res = await djangoRequest<{ email_notifications: boolean }>(`/auth/users/${userId}/email-prefs/`);
    if (res.success && res.data) return res.data.email_notifications !== false;
    return true; // default to enabled
  } catch {
    return true;
  }
}

/**
 * Get user email by ID
 */
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const res = await djangoRequest<{ email: string }>(`/auth/users/${userId}/`);
    if (res.success && res.data?.email) return res.data.email;
    return null;
  } catch {
    return null;
  }
}

// ====================
// APPROVAL EMAILS
// ====================

export async function sendApprovalSubmittedEmail(params: {
  approvalId: string;
  requesterName: string;
  assetName: string;
  action: string;
  notes?: string;
  managersToNotify: string[]; // user IDs or emails
}): Promise<void> {
  const template = approvalSubmittedTemplate({
    requesterName: params.requesterName,
    assetName: params.assetName,
    action: params.action,
    notes: params.notes,
    approvalId: params.approvalId,
    dashboardUrl: getDashboardUrl(),
  });

  const recipients: string[] = [];
  
  for (const manager of params.managersToNotify) {
    if (manager.includes("@")) {
      recipients.push(manager);
    } else {
      const email = await getUserEmail(manager);
      if (email) {
        const shouldSend = await shouldSendEmailToUser(manager);
        if (shouldSend) recipients.push(email);
      }
    }
  }

  if (recipients.length === 0) return;

  await sendEmail({
    to: recipients,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendApprovalForwardedEmail(params: {
  approvalId: string;
  managerName: string;
  assetName: string;
  action: string;
  notes?: string;
  adminsToNotify: string[]; // user IDs or emails
}): Promise<void> {
  const template = approvalForwardedTemplate({
    managerName: params.managerName,
    assetName: params.assetName,
    action: params.action,
    notes: params.notes,
    approvalId: params.approvalId,
    dashboardUrl: getDashboardUrl(),
  });

  const recipients: string[] = [];
  
  for (const admin of params.adminsToNotify) {
    if (admin.includes("@")) {
      recipients.push(admin);
    } else {
      const email = await getUserEmail(admin);
      if (email) {
        const shouldSend = await shouldSendEmailToUser(admin);
        if (shouldSend) recipients.push(email);
      }
    }
  }

  if (recipients.length === 0) return;

  await sendEmail({
    to: recipients,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendApprovalDecisionEmail(params: {
  approvalId: string;
  approverName: string;
  requesterEmail: string;
  assetName: string;
  action: string;
  decision: "approved" | "rejected";
  notes?: string;
  forwardingManagerEmail?: string; // Manager who forwarded to admin
  department?: string; // For notifying other managers on rejection
}): Promise<void> {
  // Check if requester has email notifications enabled
  let requesterEmail = params.requesterEmail;
  if (!requesterEmail.includes("@")) {
    const email = await getUserEmail(requesterEmail);
    if (!email) return;
    
    const shouldSend = await shouldSendEmailToUser(requesterEmail);
    if (!shouldSend) return;
    
    requesterEmail = email;
  }

  const template =
    params.decision === "approved"
      ? approvalApprovedTemplate({
          approverName: params.approverName,
          requesterEmail: requesterEmail,
          assetName: params.assetName,
          action: params.action,
          notes: params.notes,
          approvalId: params.approvalId,
          dashboardUrl: getDashboardUrl(),
        })
      : approvalRejectedTemplate({
          approverName: params.approverName,
          requesterEmail: requesterEmail,
          assetName: params.assetName,
          action: params.action,
          notes: params.notes,
          approvalId: params.approvalId,
          dashboardUrl: getDashboardUrl(),
        });

  // Send to requester
  await sendEmail({
    to: requesterEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });

  // If rejected by admin, also notify the manager who forwarded it
  if (params.decision === "rejected" && params.forwardingManagerEmail) {
    const managerTemplate = approvalRejectedTemplate({
      approverName: params.approverName,
      requesterEmail: params.forwardingManagerEmail,
      assetName: params.assetName,
      action: params.action,
      notes: params.notes,
      approvalId: params.approvalId,
      dashboardUrl: getDashboardUrl(),
    });

    await sendEmail({
      to: params.forwardingManagerEmail,
      subject: `Admin Rejected: ${params.assetName}`,
      html: managerTemplate.html,
      text: managerTemplate.text,
    });
  }
}

// ====================
// NEWSLETTER EMAILS
// ====================

export async function sendNewsletterEmail(params: {
  title: string;
  body: string;
  category: string;
  author?: string;
  recipientEmails: string[]; // List of all subscribers
}): Promise<void> {
  const template = newsletterPublishedTemplate({
    title: params.title,
    body: params.body,
    category: params.category,
    author: params.author,
    publishedAt: new Date().toISOString(),
    dashboardUrl: getDashboardUrl(),
  });

  if (params.recipientEmails.length === 0) return;

  // Send as BCC to protect recipient privacy
  await sendEmail({
    to: "noreply@sams.local", // Placeholder
    bcc: params.recipientEmails,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

// ====================
// TICKET EMAILS
// ====================

export async function sendTicketAssignedEmail(params: {
  ticketId: string;
  title: string;
  description?: string;
  priority: string;
  assetName?: string;
  assignedBy: string;
  assignedToEmail: string;
}): Promise<void> {
  // Check if assignee wants email notifications
  if (!params.assignedToEmail.includes("@")) {
    const email = await getUserEmail(params.assignedToEmail);
    if (!email) return;
    
    const shouldSend = await shouldSendEmailToUser(params.assignedToEmail);
    if (!shouldSend) return;
    
    params.assignedToEmail = email;
  }

  const template = ticketAssignedTemplate({
    ticketId: params.ticketId,
    title: params.title,
    description: params.description,
    priority: params.priority,
    assetName: params.assetName,
    assignedBy: params.assignedBy,
    assignedTo: params.assignedToEmail,
    dashboardUrl: getDashboardUrl(),
  });

  await sendEmail({
    to: params.assignedToEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendTicketStatusUpdateEmail(params: {
  ticketId: string;
  title: string;
  oldStatus: string;
  newStatus: string;
  updatedBy: string;
  comment?: string;
  recipientEmails: string[]; // Creator, assignee, watchers
}): Promise<void> {
  const template = ticketStatusUpdateTemplate({
    ticketId: params.ticketId,
    title: params.title,
    oldStatus: params.oldStatus,
    newStatus: params.newStatus,
    updatedBy: params.updatedBy,
    comment: params.comment,
    dashboardUrl: getDashboardUrl(),
  });

  if (params.recipientEmails.length === 0) return;

  await sendEmail({
    to: params.recipientEmails,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

// ====================
// AUDIT EMAILS
// ====================

export async function sendAuditStartedEmail(params: {
  sessionId: string;
  frequency: string;
  propertyName?: string;
  initiatedBy: string;
  departments: string[];
  recipientEmails: string[]; // Department heads, assigned reviewers
}): Promise<void> {
  const template = auditStartedTemplate({
    sessionId: params.sessionId,
    frequency: params.frequency,
    propertyName: params.propertyName,
    initiatedBy: params.initiatedBy,
    departments: params.departments,
    dashboardUrl: getDashboardUrl(),
  });

  if (params.recipientEmails.length === 0) return;

  await sendEmail({
    to: params.recipientEmails,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendAuditSubmittedEmail(params: {
  sessionId: string;
  department: string;
  submittedBy: string;
  assetsReviewed: number;
  recipientEmails: string[]; // Admins, audit coordinators
}): Promise<void> {
  const template = auditSubmittedTemplate({
    sessionId: params.sessionId,
    department: params.department,
    submittedBy: params.submittedBy,
    assetsReviewed: params.assetsReviewed,
    dashboardUrl: getDashboardUrl(),
  });

  if (params.recipientEmails.length === 0) return;

  await sendEmail({
    to: params.recipientEmails,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

// ====================
// USER MANAGEMENT EMAILS
// ====================

export async function sendWelcomeEmail(params: {
  userName: string;
  userEmail: string;
  role: string;
  temporaryPassword?: string;
}): Promise<void> {
  const template = welcomeEmailTemplate({
    userName: params.userName,
    userEmail: params.userEmail,
    role: params.role,
    temporaryPassword: params.temporaryPassword,
    dashboardUrl: getDashboardUrl(),
  });

  await sendEmail({
    to: params.userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendPasswordResetEmail(params: {
  userName: string;
  userEmail: string;
  resetToken: string;
  expiresIn?: string;
}): Promise<void> {
  const template = passwordResetTemplate({
    userName: params.userName,
    resetToken: params.resetToken,
    expiresIn: params.expiresIn || "1 hour",
    dashboardUrl: getDashboardUrl(),
  });

  await sendEmail({
    to: params.userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

export async function sendPasswordResetCodeEmail(params: {
  userName: string;
  userEmail: string;
  code: string;
  expiresInMinutes: number;
  attemptsAllowed?: number;
}): Promise<boolean> {
  const template = passwordResetOtpTemplate({
    userName: params.userName,
    code: params.code,
    expiresInMinutes: params.expiresInMinutes,
    attemptsAllowed: params.attemptsAllowed,
    dashboardUrl: getDashboardUrl(),
  });

  return sendEmail({
    to: params.userEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
}

// ====================
// HELPER: Get Admin Emails
// ====================

export async function getAdminEmails(): Promise<string[]> {
  try {
    const res = await djangoRequest<Array<{ email: string; id: string }>>('/auth/users/?role=admin&status=active&limit=100');
    const users = Array.isArray(res.data) ? res.data : (res.data as any)?.results ?? [];
    const emails: string[] = [];
    for (const user of users) {
      if (user.email) {
        const shouldSend = await shouldSendEmailToUser(user.id);
        if (shouldSend) emails.push(user.email);
      }
    }
    return emails;
  } catch {
    return [];
  }
}

// ====================
// HELPER: Get Manager Emails
// ====================

export async function getManagerEmails(department?: string): Promise<string[]> {
  try {
    let endpoint = '/auth/users/?role=manager&status=active&limit=100';
    if (department) endpoint += `&department=${encodeURIComponent(department)}`;

    const res = await djangoRequest<Array<{ email: string; id: string }>>(endpoint);
    const users = Array.isArray(res.data) ? res.data : (res.data as any)?.results ?? [];
    const emails: string[] = [];
    for (const user of users) {
      if (user.email) {
        const shouldSend = await shouldSendEmailToUser(user.id);
        if (shouldSend) emails.push(user.email);
      }
    }
    return emails;
  } catch {
    return [];
  }
}

// ====================
// HELPER: Get All User Emails (for newsletters)
// ====================

export async function getAllUserEmails(): Promise<string[]> {
  try {
    const res = await djangoRequest<Array<{ email: string; id: string }>>('/auth/users/?status=active&limit=500');
    const users = Array.isArray(res.data) ? res.data : (res.data as any)?.results ?? [];
    const emails: string[] = [];
    for (const user of users) {
      if (user.email) {
        const shouldSend = await shouldSendEmailToUser(user.id);
        if (shouldSend) emails.push(user.email);
      }
    }
    return emails;
  } catch {
    return [];
  }
}
