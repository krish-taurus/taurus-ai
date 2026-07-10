/**
 * Landing v3 FAQ content (Sprint 055) — pure data, no React.
 *
 * One source of truth consumed by both the on-page accordion and the FAQPage
 * structured data in the page head, so search engines and visitors always read
 * the same answers. Plain language on purpose.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is an AI Employee?",
    a: "An AI Employee is a specialised digital team member with a defined role, goals, personality and boundaries. Unlike a chat tool, it keeps a persistent identity, answers from your company's own knowledge, uses your tools, works on your channels and reports on its performance.",
  },
  {
    q: "How is Taurus AI different from a chatbot?",
    a: "A chatbot answers messages. A Taurus AI Employee holds a job: it has responsibilities, follows your business rules, executes multi-step workflows across your tools, asks a human for approval on sensitive actions, and is reviewed on outcomes — just like a hire.",
  },
  {
    q: "Can Taurus AI connect to our existing business tools?",
    a: "Yes. AI Employees connect to email, Slack, Microsoft Teams, WhatsApp, SMS, Telegram, Messenger, Instagram, website chat and phone, and the Knowledge Vault syncs from Google Drive, SharePoint, cloud storage, live databases, files and web pages. Workflows can also call webhooks to reach other systems.",
  },
  {
    q: "Can we use our own AI model API keys?",
    a: "Yes. The Model Hub works with Taurus-managed models out of the box, and on paid plans you can bring your own provider keys, stored encrypted. You can assign different models to different employees and switch providers without rebuilding anything.",
  },
  {
    q: "How does Taurus AI protect company information?",
    a: "Your knowledge lives in a per-organisation Knowledge Vault with strict data isolation. Credentials are encrypted at rest, access is role-based, usage is limited by plan, and every action is written to an audit trail you can review.",
  },
  {
    q: "Can AI Employees work across email, chat, WhatsApp and phone?",
    a: "Yes — one employee can work every channel at once: your website widget, WhatsApp, SMS, email, Telegram, Messenger, Instagram, Slack, Microsoft Teams and voice calls, with the same identity and knowledge everywhere.",
  },
  {
    q: "Can human employees approve AI actions?",
    a: "Yes. Workflows include approval steps that pause the run until a person approves or rejects it, with full context attached. Escalation rules in the Employee DNA also route sensitive conversations to humans automatically.",
  },
  {
    q: "How long does it take to create an AI Employee?",
    a: "Minutes. Choose a role in the Hiring Studio, shape its DNA, add knowledge, connect a channel and deploy. The free Starter plan needs no credit card, so the first employee costs nothing to try.",
  },
  {
    q: "Can multiple AI Employees work together?",
    a: "Yes. Workflows chain employees together — one qualifies a lead, another prepares research, another books the meeting — passing context along, calling sub-workflows, and pausing for human approval where you decide it matters.",
  },
  {
    q: "How is the performance of an AI Employee measured?",
    a: "Scheduled Performance Reviews score real conversations against the Employee DNA — grounded answers, staying inside boundaries, escalating at the right moment, tone — and dashboards track interactions, workflow runs and usage, so you manage outcomes, not impressions.",
  },
];
