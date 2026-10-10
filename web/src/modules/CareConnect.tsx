import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocket, useSocketEvent } from '../lib/socket';
import { NotificationList, useNotifications } from '../layout/Shell';
import { Avatar, Band, Empty, fmtDay, fmtTime, Head, Icon, Modal, useLoad, useToast } from '../lib/ui';

interface Thread {
  id: string;
  kind: 'DIRECT' | 'BOT';
  unread: number;
  lastMessage: Msg | null;
  lastMessageAt: string;
  otherLastReadAt: string | null;
  other: { userId: string; name: string; role: string; subtitle: string; online: boolean };
}
interface Msg { id: string; threadId: string; senderId: string | null; isBot: boolean; body: string; createdAt: string }
interface Contact { userId: string; name: string; subtitle: string; role: string; online: boolean }

const PROMPTS = ['When is my next appointment?', 'Do I have anything to pay?', 'What is on my prescription?', 'What does my risk band mean?', 'Can I stop my medicine early?'];

export default function CareConnect() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const { socket, online } = useSocket();
  const notif = useNotifications();
  const [params, setParams] = useSearchParams();
  const threads = useLoad(() => api<Thread[]>('/chat/threads'), []);
  const [activeId, setActiveId] = useState<string | null>(params.get('thread'));
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const typingSent = useRef(0);

  const list = threads.data ?? [];
  const active = list.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    if (!activeId && list.length) setActiveId(list[0].id);
  }, [list.length]);

  // Load messages and mark read when the active thread changes.
  useEffect(() => {
    if (!activeId) return;
    setParams({ thread: activeId }, { replace: true });
    setLoadingMsgs(true);
    api<Msg[]>(`/chat/threads/${activeId}/messages`)
      .then(setMsgs)
      .finally(() => setLoadingMsgs(false));
    api(`/chat/threads/${activeId}/read`, { method: 'POST' }).then(() =>
      threads.setData((l) => l?.map((t) => (t.id === activeId ? { ...t, unread: 0 } : t)) ?? l),
    );
  }, [activeId]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [msgs.length, typing]);

  useSocketEvent<{ threadId: string; message: Msg }>('message:new', ({ threadId, message }) => {
    if (threadId === activeId) {
      setMsgs((l) => (l.some((m) => m.id === message.id) ? l : [...l, message]));
      if (message.senderId !== user?.id) api(`/chat/threads/${threadId}/read`, { method: 'POST' }).catch(() => null);
    }
    threads.setData((l) => {
      if (!l) return l;
      if (!l.some((t) => t.id === threadId)) {
        threads.reload();
        return l;
      }
      return l
        .map((t) => (t.id === threadId ? { ...t, lastMessage: message, lastMessageAt: message.createdAt, unread: threadId === activeId || message.senderId === user?.id ? 0 : t.unread + 1 } : t))
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    });
  });
  useSocketEvent<{ threadId: string; name: string; typing: boolean }>('typing', (p) =>
    setTyping((m) => {
      const n = { ...m };
      if (p.typing) n[p.threadId] = p.name;
      else delete n[p.threadId];
      return n;
    }),
  );
  useSocketEvent<{ threadId: string; at: string }>('thread:read', (p) =>
    threads.setData((l) => l?.map((t) => (t.id === p.threadId ? { ...t, otherLastReadAt: p.at } : t)) ?? l),
  );

  const send = async (body: string) => {
    if (!activeId || !body.trim()) return;
    setText('');
    socket?.emit('typing', { threadId: activeId, typing: false });
    try {
      const m = await api<Msg>(`/chat/threads/${activeId}/messages`, { body: { body } });
      setMsgs((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
    } catch (e) {
      setText(body);
      toast((e as Error).message, 'err');
    }
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };
  const onType = (v: string) => {
    setText(v);
    if (active?.kind === 'DIRECT' && Date.now() - typingSent.current > 1500) {
      typingSent.current = Date.now();
      socket?.emit('typing', { threadId: activeId, typing: true });
      setTimeout(() => socket?.emit('typing', { threadId: activeId, typing: false }), 2500);
    }
  };

  const startWith = async (c: Contact) => {
    setPicking(false);
    try {
      const t = await api<Thread>('/chat/threads', { body: { userId: c.userId } });
      await threads.reload();
      setActiveId(t.id);
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };

  const shown = list.filter((t) => !filter || `${t.other.name} ${t.lastMessage?.body ?? ''}`.toLowerCase().includes(filter.toLowerCase()));
  const isOnline = (t: Thread) => t.kind === 'BOT' || online.has(t.other.userId);
  const seenUpTo = active?.otherLastReadAt ? new Date(active.otherLastReadAt).getTime() : 0;
  const lastMine = useMemo(() => [...msgs].reverse().find((m) => m.senderId === user?.id), [msgs, user?.id]);
  const bot = active?.kind === 'BOT';

  return (
    <>
      <Band title="CareConnect hub" sub="Message your doctor or patients, get instant answers from CareBot, and never miss an update." art="/img/doctors-review.jpg" />

      <div className="row stack-lg" style={{ alignItems: 'stretch' }}>
        {/* ------------------------------------------------ threads */}
        <section className="card side-300">
          <Head title="Conversations" right={<button className="ibtn sm" aria-label="New conversation" onClick={() => setPicking(true)}><Icon n="plus" s={15} /></button>} />
          <span className="inp" style={{ marginTop: 11 }}><Icon n="search" s={15} /><input type="search" placeholder="Search messages" value={filter} onChange={(e) => setFilter(e.target.value)} /></span>
          <div className="col" style={{ gap: 3, marginTop: 10 }}>
            {threads.loading && !threads.data && <div className="skeleton" style={{ height: 120 }} />}
            {shown.map((t) => (
              <button key={t.id} className={`pick${t.id === activeId ? ' on' : ''}`} onClick={() => setActiveId(t.id)}>
                <span style={{ position: 'relative' }}>
                  <Avatar name={t.kind === 'BOT' ? 'Care Bot' : t.other.name} size={38} cls={t.kind === 'BOT' ? 'c3' : 'c2'} />
                  {isOnline(t) && <span className="dot" style={{ position: 'absolute', right: 0, bottom: 0, background: 'var(--ok)', boxShadow: '0 0 0 2px var(--surface)' }} />}
                </span>
                <span className="grow">
                  <b style={{ display: 'block', fontSize: 12.5 }}>{t.other.name}</b>
                  <span className="tiny" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {typing[t.id] ? <i style={{ color: 'var(--brand)' }}>typing…</i> : t.lastMessage?.body ?? 'No messages yet'}
                  </span>
                </span>
                <span className="col" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <span className="tiny" style={{ fontSize: 10 }}>{t.lastMessage ? fmtTime(t.lastMessage.createdAt) : ''}</span>
                  {t.unread > 0 && <span className="badge">{t.unread}</span>}
                </span>
              </button>
            ))}
            {threads.data && !shown.length && <Empty icon="chat" title={filter ? 'No match' : 'No conversations yet'}>{user?.role === 'PATIENT' ? 'Book an appointment to message a doctor.' : 'Patients appear here after they book you.'}</Empty>}
          </div>
        </section>

        {/* ------------------------------------------------ messages */}
        <section className="card grow" style={{ display: 'flex', flexDirection: 'column', minHeight: 580 }}>
          {!active ? (
            <Empty icon="chat" title="Pick a conversation">Or press + to start one.</Empty>
          ) : (
            <>
              <div className="between" style={{ paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
                <div className="ctr" style={{ gap: 11 }}>
                  <Avatar name={bot ? 'Care Bot' : active.other.name} size={40} cls={bot ? 'c3' : 'c2'} />
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{active.other.name}</div>
                    <div className="ctr" style={{ gap: 6 }}>
                      <span className="dot" style={{ background: isOnline(active) ? 'var(--ok)' : 'var(--muted)' }} />
                      <span className="tiny">{bot ? active.other.subtitle : `${isOnline(active) ? 'Online' : 'Offline'} · ${active.other.subtitle}`}</span>
                    </div>
                  </div>
                </div>
                <div className="ctr" style={{ gap: 7 }}>
                  {!bot && user?.role === 'PATIENT' && <button className="ibtn" aria-label="Book a follow-up" title="Book a follow-up" onClick={() => nav('/app/portal')}><Icon n="cal" s={16} /></button>}
                  {!bot && <button className="ibtn" aria-label="Share a record" title="Share a record" onClick={() => setSharing(true)}><Icon n="share" s={16} /></button>}
                </div>
              </div>

              <div className="thread grow" ref={scroller} style={{ padding: '14px 2px', maxHeight: 460 }} aria-live="polite">
                {loadingMsgs && !msgs.length && <div className="skeleton" style={{ height: 80 }} />}
                {msgs.map((m, i) => {
                  const mine = m.senderId === user?.id;
                  const newDay = i === 0 || fmtDay(msgs[i - 1].createdAt) !== fmtDay(m.createdAt);
                  return (
                    <div key={m.id}>
                      {newDay && <div style={{ textAlign: 'center', margin: '6px 0 10px' }}><span className="chip">{fmtDay(m.createdAt)}</span></div>}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                        <div className={`bub ${mine ? 'me' : m.isBot ? 'bot' : 'them'}`}>{m.body}</div>
                        <span className="bstamp">
                          {fmtTime(m.createdAt)}
                          {mine && !bot && m.id === lastMine?.id && (new Date(m.createdAt).getTime() <= seenUpTo ? ' · Seen' : ' · Delivered')}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {typing[active.id] && (
                  <div className="ctr typing" style={{ gap: 5, color: 'var(--muted)', fontSize: 11, fontWeight: 600 }}>
                    <span /><span /><span /> {typing[active.id]} is typing…
                  </div>
                )}
              </div>

              {bot && (
                <div className="ctr wrap" style={{ gap: 7, paddingBottom: 11 }}>
                  {PROMPTS.map((p) => <button key={p} className="chip" onClick={() => send(p)}>{p}</button>)}
                </div>
              )}
              <form onSubmit={onSubmit} className="ctr" style={{ gap: 9, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 13, padding: '8px 10px' }}>
                {!bot && <button type="button" className="ibtn sm" aria-label="Share a record" onClick={() => setSharing(true)}><Icon n="plus" s={15} /></button>}
                <label className="sr" htmlFor="msgIn">Write a message</label>
                <input id="msgIn" value={text} maxLength={2000} onChange={(e) => onType(e.target.value)} autoComplete="off"
                  placeholder={bot ? 'Ask CareBot about appointments, payments, reports…' : 'Write a message…'}
                  style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 0, fontSize: 13 }} />
                <button className="btn btn-p sm" disabled={!text.trim()}><Icon n="send" s={14} /> Send</button>
              </form>
            </>
          )}
        </section>

        {/* ------------------------------------------------ notifications */}
        <section className="card side-300">
          <Head title="Notifications" right={<button className="btn btn-g xs" onClick={notif.readAll} disabled={!notif.unread}>Mark all read</button>} />
          <div style={{ marginTop: 6, maxHeight: 330, overflowY: 'auto' }}><NotificationList limit={12} /></div>
          {user?.role === 'PATIENT' && (
            <div style={{ background: 'var(--lime-soft)', border: '1px solid #d5d9f6', borderRadius: 10, padding: 16, marginTop: 12 }}>
              <span className="aitag">CAREBOT</span>
              <div className="tiny" style={{ marginTop: 8, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                Answers admin and general questions from your real appointments, payments and records. Anything needing medical judgement is forwarded to your doctor — it never diagnoses, doses or changes treatment.
              </div>
              <button className="btn btn-p sm full" style={{ marginTop: 12, background: 'var(--lime)', borderColor: 'var(--lime)' }} onClick={() => setActiveId(list.find((t) => t.kind === 'BOT')?.id ?? null)}>Open CareBot</button>
            </div>
          )}
        </section>
      </div>

      {picking && <ContactPicker onClose={() => setPicking(false)} onPick={startWith} />}
      {sharing && active && (
        <ShareRecord onClose={() => setSharing(false)} onShare={(title) => { setSharing(false); send(`📎 Shared record: ${title}`); }} />
      )}
    </>
  );
}

function ContactPicker({ onClose, onPick }: { onClose: () => void; onPick: (c: Contact) => void }) {
  const contacts = useLoad(() => api<Contact[]>('/chat/contacts'), []);
  return (
    <Modal title="New conversation" eyebrow="CARE RELATIONSHIPS ONLY" onClose={onClose}>
      <div className="tiny">You can message a doctor you have booked, or a patient who has booked you.</div>
      <div className="col" style={{ gap: 7, marginTop: 12 }}>
        {contacts.data?.map((c) => (
          <button key={c.userId} className="pick" style={{ border: '1px solid var(--line)' }} onClick={() => onPick(c)}>
            <Avatar name={c.name} size={36} cls="c2" />
            <span className="grow"><b style={{ display: 'block', fontSize: 13 }}>{c.name}</b><span className="tiny">{c.subtitle}</span></span>
            <span className="dot" style={{ background: c.online ? 'var(--ok)' : 'var(--muted)' }} />
          </button>
        ))}
        {contacts.data && !contacts.data.length && <Empty icon="users" title="No contacts yet">Book an appointment first.</Empty>}
      </div>
    </Modal>
  );
}

function ShareRecord({ onClose, onShare }: { onClose: () => void; onShare: (title: string) => void }) {
  const { user } = useAuth();
  const recs = useLoad(() => (user?.role === 'PATIENT' ? api<{ id: string; title: string; kind: string }[]>('/records') : Promise.resolve([])), []);
  return (
    <Modal title="Share a record in this chat" onClose={onClose}>
      <div className="col" style={{ gap: 7 }}>
        {recs.data?.map((r) => (
          <button key={r.id} className="pick" style={{ border: '1px solid var(--line)' }} onClick={() => onShare(r.title)}>
            <Icon n="file" s={16} /><span className="grow"><b style={{ fontSize: 13 }}>{r.title}</b></span><span className="chip">{r.kind}</span>
          </button>
        ))}
        {recs.data && !recs.data.length && <div className="tiny">Records you can share appear here. Doctors see shared records in the patient's history.</div>}
      </div>
    </Modal>
  );
}
