import { useState, useMemo } from "react";
import { Search, Plus, X, Send, CheckCircle2, Clock } from "lucide-react";
import Tooltip from "./Tooltip";

const INITIAL_BENEFICIARIES = [
  { id: 1, nickname: "Test Company Inc", currency: "CAD", bank: "TD Bank", country: "Canada", account: "12345678", status: "approved" },
  { id: 2, nickname: "Maple Supply Co.", currency: "CAD", bank: "RBC Royal Bank", country: "Canada", account: "55018842", status: "approved" },
  { id: 3, nickname: "Lone Star Logistics", currency: "USD", bank: "Chase", country: "United States", account: "90044127", status: "approved" },
  { id: 4, nickname: "Pacific Freight LLC", currency: "USD", bank: "Bank of America", country: "United States", account: "30981265", status: "pending" },
];

const STATUS_STYLES = {
  approved: { label: "Approved", className: "text-success bg-success-100", icon: CheckCircle2 },
  pending: { label: "Pending review", className: "text-warning bg-warning-100", icon: Clock },
};

// Show only the last 4 digits — never display a full account number on screen
const maskAccount = (acc) => `••••${acc.slice(-4)}`;

const EMPTY_FORM = { nickname: "", currency: "CAD", bank: "", country: "Canada", account: "" };

export default function Beneficiaries({ onNavigate }) {
  const [beneficiaries, setBeneficiaries] = useState(INITIAL_BENEFICIARIES);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return beneficiaries;
    return beneficiaries.filter(
      (b) =>
        b.nickname.toLowerCase().includes(q) ||
        b.bank.toLowerCase().includes(q) ||
        b.currency.toLowerCase().includes(q)
    );
  }, [beneficiaries, query]);

  const canSave = form.nickname.trim() && form.bank.trim() && form.account.trim().length >= 4;

  function handleSave(e) {
    e.preventDefault();
    if (!canSave) return;
    setBeneficiaries((prev) => [
      { id: Date.now(), ...form, nickname: form.nickname.trim(), bank: form.bank.trim(), account: form.account.trim(), status: "pending" },
      ...prev,
    ]);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  return (
    <div className="flex-1 bg-gray-50 p-6 min-w-0">
      <div className="flex items-center justify-between mb-4 mt-5">
        <h1 className="text-xl font-semibold text-gray-900">Beneficiaries</h1>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add beneficiary
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4 max-w-auto">
        The people and companies you pay. New beneficiaries are reviewed by our team before you can send to them.
      </p>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, bank or currency"
          className="w-full text-sm border border-gray-200 rounded-md pl-9 pr-3 py-2.5 bg-white shadow-2xs focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100 transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="grid grid-cols-[1.5fr_0.7fr_1.2fr_1fr_1fr_1fr] gap-3 text-[11px] text-gray-400 border-b border-gray-100 pb-1.5">
          <span>Nickname</span>
          <span>Currency</span>
          <span>Bank</span>
          <span className="flex items-center gap-1">
            Account
            <Tooltip text="For your security we only show the last 4 digits of each account number." />
          </span>
          <span>Status</span>
          <span />
        </div>

        {visible.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            No beneficiaries match &ldquo;{query}&rdquo;.
          </p>
        )}

        {visible.map((b, i) => {
          const status = STATUS_STYLES[b.status];
          const StatusIcon = status.icon;
          return (
            <div
              key={b.id}
              className={`grid grid-cols-[1.5fr_0.7fr_1.2fr_1fr_1fr_1fr] gap-3 items-center py-3 text-sm ${
                i < visible.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <span className="font-medium text-gray-900">{b.nickname}</span>
              <span>{b.currency}</span>
              <span className="text-gray-700">
                {b.bank}
                <span className="block text-[11px] text-gray-400">{b.country}</span>
              </span>
              <span className="font-mono text-gray-500">{maskAccount(b.account)}</span>
              <span>
                <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${status.className}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </span>
              <span className="text-right">
                  <button
                    type="button"
                    disabled={b.status !== "approved"}
                    onClick={() => onNavigate("send-payment")}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded bg-accent-100 text-accent hover:bg-accent hover:text-white transition-all disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed shadow-2xs"
                  >
                    <Send className="w-3 h-3" />
                    Pay
                  </button>
                </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Showing {visible.length} of {beneficiaries.length} beneficiaries
      </p>

      {/* Add beneficiary modal */}
      {showForm && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Add a beneficiary</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Who are you paying?</label>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  placeholder="e.g. Acme Supplies Ltd"
                  className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Currency they receive</label>
                  <select
                    value={form.currency}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        currency: e.target.value,
                        country: e.target.value === "CAD" ? "Canada" : "United States",
                      })
                    }
                    className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2"
                  >
                    <option>CAD</option>
                    <option>USD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Their bank</label>
                  <input
                    type="text"
                    value={form.bank}
                    onChange={(e) => setForm({ ...form, bank: e.target.value })}
                    placeholder="e.g. TD Bank"
                    className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Account number</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.account}
                  onChange={(e) => setForm({ ...form, account: e.target.value.replace(/\D/g, "") })}
                  placeholder="Digits only"
                  className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 font-mono"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Once saved, only the last 4 digits will be shown.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save beneficiary
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}