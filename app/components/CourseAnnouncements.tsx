"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Bell, Pencil, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { alert, toast } from "@/lib/swal";
import { tx } from "@/app/lib/theme";

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export function CourseAnnouncements({ courseId, canManage = false }: { courseId: string; canManage?: boolean }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await apiFetch<{ announcements: Announcement[] }>(`/api/announcements?courseId=${encodeURIComponent(courseId)}`);
    setAnnouncements(data?.announcements || []);
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ announcements: Announcement[] }>(`/api/announcements?courseId=${encodeURIComponent(courseId)}`).then(({ data }) => {
      if (!cancelled) {
        setAnnouncements(data?.announcements || []);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [courseId]);

  const resetForm = () => { setEditing(null); setTitle(""); setBody(""); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await apiFetch("/api/announcements", {
      method: editing ? "PUT" : "POST",
      body: JSON.stringify(editing ? { id: editing.id, title, body } : { courseId, title, body }),
    });
    setSaving(false);
    if (error) return toast.error(error);
    resetForm();
    await load();
    toast.success(editing ? "แก้ไขประกาศเรียบร้อยแล้ว" : "เผยแพร่ประกาศเรียบร้อยแล้ว");
  };

  const remove = async (id: string) => {
    if (!await alert.confirm("ลบประกาศ?", "นักเรียนจะไม่สามารถดูประกาศนี้ได้อีก", "ลบ")) return;
    const { error } = await apiFetch(`/api/announcements?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (error) return toast.error(error);
    await load();
    toast.success("ลบประกาศเรียบร้อยแล้ว");
  };

  return (
    <section className="rounded-3xl border p-4 md:p-5 space-y-4" style={{ backgroundColor: tx.surface, borderColor: tx.borderS }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><span className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center"><Bell className="h-4 w-4" /></span><div><h2 className="font-extrabold text-sm">ประกาศ</h2><p className="text-xs" style={{ color: tx.muted }}>ข่าวสารและการแจ้งเตือนจากผู้สอน</p></div></div>
        {canManage && !editing && title === "" && <button type="button" onClick={() => setTitle(" ")} className="btn-primary px-3 py-2 text-xs flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" />เพิ่มประกาศ</button>}
      </div>

      {canManage && (editing !== null || title !== "") && <form onSubmit={save} className="rounded-2xl border p-3 space-y-3" style={{ borderColor: tx.borderS, backgroundColor: tx.elevated }}><input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="หัวข้อประกาศ" className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent" style={{ borderColor: tx.borderS }} /><textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={4} placeholder="เขียนรายละเอียดสำหรับนักเรียน" className="w-full rounded-xl border px-3 py-2 text-sm bg-transparent resize-y" style={{ borderColor: tx.borderS }} /><div className="flex justify-end gap-2"><button type="button" onClick={resetForm} className="btn-cancel px-3 py-2 text-xs">ยกเลิก</button><button disabled={saving || !title.trim()} className="btn-primary px-3 py-2 text-xs">{saving ? "กำลังบันทึก..." : editing ? "บันทึกการแก้ไข" : "เผยแพร่ประกาศ"}</button></div></form>}

      {loading ? <p className="text-xs" style={{ color: tx.muted }}>กำลังโหลดประกาศ...</p> : announcements.length === 0 ? <p className="text-sm py-2" style={{ color: tx.muted }}>ยังไม่มีประกาศในขณะนี้</p> : <div className="space-y-3">{announcements.map((announcement) => <article key={announcement.id} className="rounded-2xl border p-3.5" style={{ borderColor: tx.borderS }}><div className="flex justify-between gap-3"><div><h3 className="font-bold text-sm">{announcement.title}</h3><p className="text-[11px] mt-1" style={{ color: tx.muted }}>{new Date(announcement.created_at).toLocaleString("th-TH")}</p></div>{canManage && <div className="flex gap-1"><button type="button" aria-label="แก้ไขประกาศ" onClick={() => { setEditing(announcement); setTitle(announcement.title); setBody(announcement.body); }} className="btn-icon p-1.5 rounded-lg"><Pencil className="h-3.5 w-3.5" /></button><button type="button" aria-label="ลบประกาศ" onClick={() => void remove(announcement.id)} className="btn-icon p-1.5 rounded-lg text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></div>}</div>{announcement.body && <p className="mt-3 text-sm whitespace-pre-wrap" style={{ color: tx.secondary }}>{announcement.body}</p>}</article>)}</div>}
    </section>
  );
}
