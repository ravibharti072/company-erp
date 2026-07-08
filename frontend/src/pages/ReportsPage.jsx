import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../api/api";

const formatCurrency = (value) => {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function ReportsPage() {
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);

      const response = await api.get("/reports/dashboard-summary");
      setSummary(response.data);
    } catch (error) {
      alert(error?.response?.data?.detail || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const users = summary?.users || {};
  const attendance = summary?.attendance || {};
  const tasks = summary?.tasks || {};
  const sales = summary?.sales || {};
  const freelancers = summary?.freelancers || {};

  const overviewCards = useMemo(
    () => [
      {
        title: "Total Users",
        value: users.total_users || 0,
        icon: Users,
        tone: "blue",
      },
      {
        title: "Today Present",
        value: attendance.today_present || 0,
        icon: CalendarCheck,
        tone: "green",
      },
      {
        title: "Pending Tasks",
        value: tasks.pending || 0,
        icon: ClipboardList,
        tone: "orange",
      },
      {
        title: "Total Leads",
        value: sales.total_leads || 0,
        icon: Target,
        tone: "purple",
      },
      {
        title: "Sales Done",
        value: sales.converted_leads || 0,
        icon: TrendingUp,
        tone: "teal",
      },
      {
        title: "Paid Commission",
        value: formatCurrency(sales.paid_commission_amount || 0),
        icon: IndianRupee,
        tone: "dark",
      },
    ],
    [users, attendance, tasks, sales]
  );

  return (
    <>
      <style>{reportsPageStyles}</style>

      <div className="reports-page">
        <div className="page-header">
          <div className="page-title-wrap">
            <button
              type="button"
              className="back-button"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={18} />
            </button>

            <div className="page-title-icon">
              <BarChart3 size={22} />
            </div>

            <div>
              <h1>Reports</h1>
              <p>
                Company summary for people, attendance, tasks, sales,
                commissions, and freelancer payments.
              </p>
            </div>
          </div>

          <div className="header-actions">
            <span className="count-pill">
              {loading ? "Loading..." : "Live Summary"}
            </span>

            <button
              type="button"
              className="refresh-button"
              onClick={fetchReports}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "spin-icon" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <section className="summary-grid">
          {overviewCards.map((card) => (
            <article
              className={`summary-card summary-${card.tone}`}
              key={card.title}
            >
              <card.icon size={19} />
              <div>
                <p>{card.title}</p>
                <strong>{card.value}</strong>
              </div>
            </article>
          ))}
        </section>

        <section className="reports-grid">
          <ReportCard
            icon={Users}
            title="Users Report"
            description="Software users and team role summary."
            tone="blue"
            rows={[
              ["Total Users", users.total_users || 0],
              ["Employees", users.employees || 0],
              ["Interns", users.interns || 0],
              ["Sales Representatives", users.sales_representatives || 0],
              ["Freelancers", users.freelancers || 0],
            ]}
          />

          <ReportCard
            icon={CalendarCheck}
            title="Attendance Report"
            description="Daily attendance overview."
            tone="green"
            rows={[["Today Present", attendance.today_present || 0]]}
          />

          <ReportCard
            icon={ClipboardList}
            title="Task Report"
            description="Current task progress status."
            tone="orange"
            rows={[
              ["Pending Tasks", tasks.pending || 0],
              ["In Progress", tasks.in_progress || 0],
              ["Completed", tasks.completed || 0],
            ]}
          />

          <ReportCard
            icon={Target}
            title="Sales Report"
            description="Lead generation and conversion summary."
            tone="purple"
            rows={[
              ["Total Leads", sales.total_leads || 0],
              ["Converted Leads", sales.converted_leads || 0],
            ]}
          />

          <ReportCard
            icon={IndianRupee}
            title="Commission Report"
            description="Sales commission payable and paid amount."
            tone="dark"
            rows={[
              [
                "Pending Commission",
                formatCurrency(sales.pending_commission_amount || 0),
              ],
              [
                "Paid Commission",
                formatCurrency(sales.paid_commission_amount || 0),
              ],
            ]}
          />

          <ReportCard
            icon={BriefcaseBusiness}
            title="Freelancer Report"
            description="Freelancer projects and payment summary."
            tone="teal"
            rows={[
              ["Total Projects", freelancers.total_projects || 0],
              ["Submitted Projects", freelancers.submitted_projects || 0],
              ["Completed Projects", freelancers.completed_projects || 0],
              [
                "Pending Payment",
                formatCurrency(freelancers.pending_payment_amount || 0),
              ],
              [
                "Paid Payment",
                formatCurrency(freelancers.paid_payment_amount || 0),
              ],
            ]}
          />
        </section>

        <section className="mvp-status-card">
          <div className="mvp-left">
            <div className="mvp-icon">
              <CheckCircle2 size={22} />
            </div>

            <div>
              <h2>MVP Status</h2>
              <p>
                Your Company ERP MVP is ready with login, dashboard, people
                onboarding, software users, attendance, tasks, sales CRM,
                freelancer projects, payments, and reports.
              </p>
            </div>
          </div>

          <span className="ready-pill">Ready</span>
        </section>
      </div>
    </>
  );
}

function ReportCard({ icon: Icon, title, description, rows, tone }) {
  return (
    <article className="report-card">
      <div className="report-card-header">
        <div className={`report-icon report-${tone}`}>
          <Icon size={21} />
        </div>

        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      <div className="report-row-list">
        {rows.map(([label, value]) => (
          <div className="report-row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

const reportsPageStyles = `
.reports-page {
  width: 100%;
  min-height: calc(100vh - 58px);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-header {
  min-height: 92px;
  padding: 20px 22px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--erp-border, #e2e8f0);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.page-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.back-button {
  width: 40px;
  height: 40px;
  border: 1px solid #dbeafe;
  background: #ffffff;
  color: #2563eb;
  border-radius: 13px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.05);
}

.page-title-icon {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  color: #2563eb;
  background: #eef6ff;
  border: 1px solid #dbeafe;
  flex-shrink: 0;
}

.page-header h1 {
  margin: 0;
  color: #06142b;
  font-size: 27px;
  line-height: 1.1;
  font-weight: 700;
}

.page-header p {
  margin: 7px 0 0;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.count-pill {
  height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #334155;
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 800;
}

.refresh-button {
  min-width: 116px;
  height: 42px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
}

.refresh-button:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}

.spin-icon {
  animation: spinReports 0.8s linear infinite;
}

@keyframes spinReports {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  min-height: 78px;
  padding: 15px 16px;
  border-radius: 18px;
  border: 1px solid var(--erp-border, #e2e8f0);
  background: #ffffff;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.045);
  display: flex;
  align-items: center;
  gap: 13px;
}

.summary-card svg {
  width: 42px;
  height: 42px;
  padding: 11px;
  border-radius: 15px;
  flex-shrink: 0;
}

.summary-card p {
  margin: 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 600;
}

.summary-card strong {
  display: block;
  margin-top: 4px;
  color: #06142b;
  font-size: 21px;
  font-weight: 800;
  line-height: 1;
  white-space: nowrap;
}

.summary-blue svg,
.report-blue {
  color: #2563eb;
  background: #eff6ff;
}

.summary-green svg,
.report-green {
  color: #059669;
  background: #ecfdf5;
}

.summary-orange svg,
.report-orange {
  color: #ea580c;
  background: #fff7ed;
}

.summary-purple svg,
.report-purple {
  color: #7c3aed;
  background: #f5f3ff;
}

.summary-teal svg,
.report-teal {
  color: #0f766e;
  background: #f0fdfa;
}

.summary-dark svg,
.report-dark {
  color: #0f172a;
  background: #f1f5f9;
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.report-card {
  min-height: 285px;
  border-radius: 20px;
  border: 1px solid var(--erp-border, #e2e8f0);
  background: #ffffff;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.report-card-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid #eef2f7;
}

.report-icon {
  width: 44px;
  height: 44px;
  border-radius: 15px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.report-card h2 {
  margin: 0;
  color: #06142b;
  font-size: 19px;
  font-weight: 800;
}

.report-card p {
  margin: 6px 0 0;
  color: #52677e;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.report-row-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.report-row {
  min-height: 42px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-row span {
  color: #52677e;
  font-size: 13px;
  font-weight: 600;
}

.report-row strong {
  color: #06142b;
  font-size: 14px;
  font-weight: 900;
  text-align: right;
  white-space: nowrap;
}

.mvp-status-card {
  min-height: 100px;
  padding: 20px 22px;
  border-radius: 20px;
  background: linear-gradient(135deg, #eff6ff 0%, #ffffff 60%);
  border: 1px solid #bfdbfe;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.055);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.mvp-left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.mvp-icon {
  width: 46px;
  height: 46px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: #2563eb;
  background: #ffffff;
  border: 1px solid #bfdbfe;
  flex-shrink: 0;
}

.mvp-status-card h2 {
  margin: 0;
  color: #06142b;
  font-size: 20px;
  font-weight: 800;
}

.mvp-status-card p {
  margin: 7px 0 0;
  max-width: 850px;
  color: #334155;
  font-size: 13px;
  line-height: 1.55;
  font-weight: 500;
}

.ready-pill {
  height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #bbf7d0;
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  font-weight: 900;
  flex-shrink: 0;
}

@media (max-width: 1500px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .reports-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .summary-grid,
  .reports-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .mvp-status-card {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 760px) {
  .summary-grid,
  .reports-grid {
    grid-template-columns: 1fr;
  }

  .page-title-wrap {
    align-items: flex-start;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .count-pill,
  .refresh-button {
    width: 100%;
    justify-content: center;
  }

  .report-card {
    min-height: auto;
  }
}

@media (max-width: 480px) {
  .page-header {
    padding: 16px;
  }

  .page-title-icon {
    display: none;
  }

  .page-header h1 {
    font-size: 23px;
  }

  .report-card,
  .mvp-status-card {
    padding: 16px;
  }

  .report-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .report-row strong {
    text-align: left;
  }
}
`;