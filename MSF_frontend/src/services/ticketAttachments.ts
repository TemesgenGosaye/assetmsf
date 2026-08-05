import { isDemoMode } from "@/lib/demo";
import { djangoRequest } from "./djangoAuth";

export type TicketAttachment = {
  id: string; // storage path or synthetic id
  ticketId: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
};

const DEMO_KEY = 'demo_ticket_attachments';
function loadDemo(): TicketAttachment[] { try { return JSON.parse(localStorage.getItem(DEMO_KEY)||'[]'); } catch { return []; } }
function saveDemo(list: TicketAttachment[]) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(list)); } catch {} }

function djangoAttachmentToFrontend(row: any): TicketAttachment {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    name: row.file_name || row.name,
    url: row.file,
    uploadedAt: row.created_at,
    uploadedBy: row.uploaded_by_name || "user"
  };
}

export async function listAttachments(ticketId: string): Promise<TicketAttachment[]> {
  if (isDemoMode()) {
    return loadDemo().filter(a => a.ticketId === ticketId);
  }

  try {
    const res = await djangoRequest(`/maintenance/${ticketId}/attachments/`);
    if (res.success) {
      const attachments = (Array.isArray(res.data) ? res.data : []);
      return attachments.map(djangoAttachmentToFrontend);
    }
    return [];
  } catch (e) {
    console.warn('listAttachments failed, returning empty', e);
    return [];
  }
}

export async function uploadAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  if (isDemoMode()) {
    const actor = (() => { try { const raw = sessionStorage.getItem('demo_auth_user')||localStorage.getItem('demo_auth_user'); const u = raw? JSON.parse(raw): null; return (u?.email||u?.id||'user') as string; } catch { return 'user'; } })();
    const name = `${Date.now()}_${file.name}`;
    const att: TicketAttachment = { id: `ATT-${Math.floor(Math.random()*900000+100000)}`, ticketId, name: file.name, url: URL.createObjectURL(file), uploadedAt: new Date().toISOString(), uploadedBy: actor };
    const list = loadDemo();
    saveDemo([...list, att]);
    return att;
  }

  const formData = new FormData();
  formData.append('file', file);
  const res = await djangoRequest(`/maintenance/${ticketId}/attachments/`, {
    method: "POST",
    body: formData
  });
  if (res.success && res.data) {
    return djangoAttachmentToFrontend(res.data);
  }
  throw new Error(res.message || "Failed to upload attachment");
}

export async function removeAttachment(attachmentId: string): Promise<void> {
  if (isDemoMode()) {
    const list = loadDemo();
    const next = list.filter(a => a.id !== attachmentId);
    saveDemo(next);
    return;
  }

  // For Django doesn't have a delete endpoint yet, but we can add it later
  // For now just ignore
  console.log("removeAttachment not implemented for Django");
}
