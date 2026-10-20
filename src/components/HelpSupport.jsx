import { useMemo, useState } from "react";
import { Search, ChevronDown, Mail, Phone, Clock, CheckCircle2 } from "lucide-react";

const CARD = "bg-white rounded-xl border border-gray-200/70 p-4 md:p-5 mb-4";
const INPUT =
  "w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";

const FAQ = [
  {
    group: "Payments",
    items: [
      {
        q: "How do I send a payment?",
        a: "Go to Send Payment, enter the amount you want to pay or the amount they should receive, and choose who to pay. Then choose how you will fund it, check the details and confirm. You can also start from Quick Quote on the Dashboard and select Buy to continue with your quote.",
      },
      {
        q: "How do I track a payment?",
        a: "Open Reports and select the Payment tracker tab. Each payment moves through four steps: Created, Funds received, Sent and Delivered. Payments you have finished appear under Payment history.",
      },
      {
        q: "Why is my payment showing Awaiting funds?",
        a: "We have not yet received the money for this payment. Make sure the amount shown has been sent to your holding account, or that your bank has approved the direct debit. We start sending as soon as the funds arrive.",
      },
      {
        q: "What are the delivery options?",
        a: "You can choose Same day, Next day or Standard (2-3 business days). Available options depend on the currency and on the cut-off time shown when you confirm the payment.",
      },
    ],
  },
  {
    group: "Quotes and rates",
    items: [
      {
        q: "How long is my quote valid?",
        a: "A quote is held for 30 seconds. The countdown shows how much time is left. If it runs out, select Get a quote again to see a new rate.",
      },
      {
        q: "Where do the exchange rates come from?",
        a: "The rates shown in Quick Quote and Historical rates are European Central Bank daily reference rates. They are indicative only and are updated on business days. The rate you receive is confirmed before you buy.",
      },
      {
        q: "How do I set a rate alert?",
        a: "On the Dashboard, open the menu (three dots) on the Historical rates card and select Set rate alerts. Choose the currencies, an amount, the rate you are waiting for and how you want to be notified.",
      },
    ],
  },
  {
    group: "Beneficiaries and accounts",
    items: [
      {
        q: "How do I add a beneficiary?",
        a: "Go to Beneficiaries and select Add beneficiary. Enter a nickname, the currency they receive, their bank and their account number. New beneficiaries must be approved before you can pay them.",
      },
      {
        q: "What is a holding account?",
        a: "A holding account keeps money in a currency until you use it. Money you send to us, and money you receive from a trade, is held here. Select Holding Accounts to see your balances and the amounts required for payments in progress.",
      },
    ],
  },
  {
    group: "Your account",
    items: [
      {
        q: "How do I change my password?",
        a: "Open the profile menu at the bottom of the sidebar, select User settings, then open the Security tab. Enter your current password and choose a new one that meets all of the listed requirements.",
      },
      {
        q: "How do I turn on two-step verification?",
        a: "In User settings, open the Security tab and switch on Two-step verification. You can then choose to receive codes from an authenticator app or by text message.",
      },
    ],
  },
];

function FaqItem({ id, q, a, open, onToggle }) {
  return (
    <li className="border-b border-gray-100 last:border-b-0">
      <h3>
        <button
          type="button"
          id={`${id}-btn`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className="w-full flex items-center justify-between gap-4 py-3 text-left text-sm text-gray-900 hover:text-accent"
        >
          <span>{q}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </h3>
      {open && (
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-btn`} className="pb-3.5 pr-8 text-sm text-gray-600 leading-relaxed">
          {a}
        </div>
      )}
    </li>
  );
}

const TOPICS = ["Payments", "Quotes and rates", "Beneficiaries", "Holding accounts", "My account", "Something else"];

export default function HelpSupport() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState({ topic: "", message: "" });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ.map((g, gi) => ({
      ...g,
      items: g.items
        .map((it, ii) => ({ ...it, id: `faq-${gi}-${ii}` }))
        .filter((it) => !q || it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  function submit(e) {
    e.preventDefault();
    const er = {};
    if (!form.topic) er.topic = "Choose a topic.";
    if (form.message.trim().length < 10) er.message = "Please tell us a little more (at least 10 characters).";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSent(`HELP-${Math.floor(10000 + Math.random() * 89999)}`);
    setForm({ topic: "", message: "" });
  }

  return (
    <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Help &amp; support</h1>
      <p className="text-sm text-gray-500 mb-4 max-w-xl">
        Find answers to common questions, or contact our support team.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] md:gap-x-4 items-start max-w-6xl">
        {/* Left: search and FAQ */}
        <div>
          <div className="relative mb-4">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for help"
              aria-label="Search help articles"
              className="w-full text-sm border border-gray-200 rounded-md pl-9 pr-3 py-2.5 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100"
            />
          </div>

          {groups.length === 0 && (
            <div className={`${CARD} text-center text-sm text-gray-500`} role="status">
              No results for &ldquo;{query}&rdquo;. Try different words, or contact our team.
            </div>
          )}

          {groups.map((g) => (
            <section key={g.group} className={CARD} aria-label={g.group}>
              <h2 className="text-sm font-medium text-gray-900 mb-1">{g.group}</h2>
              <ul>
                {g.items.map((it) => (
                  <FaqItem
                    key={it.id}
                    id={it.id}
                    q={it.q}
                    a={it.a}
                    open={openId === it.id || (query.trim() !== "" && g.items.length === 1)}
                    onToggle={() => setOpenId(openId === it.id ? null : it.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Right: contact */}
        <div>
          <section className={CARD} aria-labelledby="hs-contact">
            <h2 id="hs-contact" className="text-sm font-medium text-gray-900 mb-3">Contact us</h2>
            <ul className="flex flex-col gap-3">
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-gray-900">support@pulsefx.com</p>
                  <p className="text-xs text-gray-500">We reply within one business day.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-gray-900">1-800-555-0123</p>
                  <p className="text-xs text-gray-500">Toll free in Canada and the United States.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-gray-900">Monday to Friday, 8:00 AM to 6:00 PM</p>
                  <p className="text-xs text-gray-500">Eastern Time, excluding holidays.</p>
                </div>
              </li>
            </ul>
          </section>

          <form onSubmit={submit} noValidate className={CARD} aria-labelledby="hs-msg">
            <h2 id="hs-msg" className="text-sm font-medium text-gray-900 mb-3">Send us a message</h2>

            {sent && (
              <p role="status" className="flex items-start gap-2 text-sm text-success bg-accent-100/60 rounded-md p-3 mb-3">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Thank you. We have received your message. Your reference is <strong>{sent}</strong>.
                </span>
              </p>
            )}

            <div className="mb-3">
              <label htmlFor="hs-topic" className="block text-[11px] text-gray-500 mb-1">Topic</label>
              <select
                id="hs-topic"
                className={INPUT}
                value={form.topic}
                onChange={(e) => {
                  setForm({ ...form, topic: e.target.value });
                  setErrors({ ...errors, topic: undefined });
                  setSent(null);
                }}
              >
                <option value="">Choose a topic</option>
                {TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              {errors.topic && <p className="text-[11px] text-danger mt-1" role="alert">{errors.topic}</p>}
            </div>

            <div className="mb-3">
              <label htmlFor="hs-message" className="block text-[11px] text-gray-500 mb-1">How can we help?</label>
              <textarea
                id="hs-message"
                rows={5}
                className={`${INPUT} resize-y`}
                value={form.message}
                onChange={(e) => {
                  setForm({ ...form, message: e.target.value });
                  setErrors({ ...errors, message: undefined });
                  setSent(null);
                }}
              />
              {errors.message && <p className="text-[11px] text-danger mt-1" role="alert">{errors.message}</p>}
            </div>

            <button
              type="submit"
              className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent-800 transition-colors"
            >
              Send message
            </button>
            <p className="text-[11px] text-gray-400 mt-3">Demo only. Your message is not sent and the contact details are samples.</p>
          </form>
        </div>
      </div>
    </div>
  );
}