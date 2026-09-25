import { Mortgage, MortgagePayment, RentPayment } from "./models.js";
import { todayIso } from "./dates.js";

export async function refreshRentStatuses(userId?: string): Promise<void> {
  const today = todayIso();
  const userFilter = userId ? { userId } : {};
  // Do not infer "paid" from amountReceived — that overwrites an explicit
  // unpaid/upcoming status right after the user saves an edit, then lists again.
  // Paid is set via create/update (and Mark paid). Only auto-age overdue upcoming.
  await Promise.all([
    RentPayment.updateMany(
      { ...userFilter, status: "upcoming", expectedPaymentDate: { $lt: today } },
      { $set: { status: "unpaid" } }
    ),
    RentPayment.updateMany(
      { ...userFilter, status: { $in: ["late", "missed", "partially_paid"] } },
      { $set: { status: "unpaid" } }
    )
  ]);
}

export async function refreshMortgagePaymentStatuses(userId?: string): Promise<void> {
  const today = todayIso();
  const filter: Record<string, unknown> = {
    status: "upcoming",
    dueDate: { $lt: today }
  };
  if (userId) {
    filter.userId = userId;
  }
  // Do not infer paid/partial from amountPaid — that overwrites an explicit
  // upcoming/overdue status right after the user saves an edit, then lists again.
  // Paid/partial is set via update (and Mark paid). Only auto-age overdue upcoming.
  await MortgagePayment.updateMany(filter, { $set: { status: "overdue" } });
}

type MortgageScheduleSource = {
  _id: unknown;
  userId: unknown;
  status?: string | null;
  startDate: string;
  endDate?: string | null;
  paymentDay?: number | null;
  monthlyRepayment: number;
};

const MORTGAGE_SCHEDULE_FIELDS = "_id userId status startDate endDate paymentDay monthlyRepayment";

async function writeMortgageSchedule(mortgage: MortgageScheduleSource, monthsAhead: number): Promise<void> {
  if (mortgage.status !== "active") {
    return;
  }

  const start = new Date(`${mortgage.startDate}T00:00:00.000Z`);
  const now = new Date();
  const historyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
  const cursorStart = start > historyStart ? start : historyStart;
  const paymentDay = Number(mortgage.paymentDay) || 1;

  const endLimit = mortgage.endDate
    ? new Date(`${mortgage.endDate}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, paymentDay));

  const horizon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, paymentDay));
  const finalDate = endLimit < horizon ? endLimit : horizon;

  let year = cursorStart.getUTCFullYear();
  let month = cursorStart.getUTCMonth();
  const safety = monthsAhead + 18;
  const ops = [];

  for (let i = 0; i < safety; i += 1) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(Math.max(paymentDay, 1), lastDay);
    const due = new Date(Date.UTC(year, month, day));

    if (due < start) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      continue;
    }
    if (due > finalDate) {
      break;
    }

    const dueDate = due.toISOString().slice(0, 10);
    ops.push({
      updateOne: {
        filter: { mortgageId: mortgage._id, dueDate },
        update: {
          $setOnInsert: {
            mortgageId: mortgage._id,
            userId: mortgage.userId,
            dueDate,
            expectedAmount: mortgage.monthlyRepayment,
            status: "upcoming",
            amountPaid: null,
            paidDate: null,
            notes: ""
          }
        },
        upsert: true
      }
    });

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  if (ops.length) {
    await MortgagePayment.bulkWrite(ops as never, { ordered: false });
  }
}

export async function ensureMortgageSchedule(
  mortgageId: string,
  userId: string,
  monthsAhead = 24
): Promise<void> {
  const mortgage = await Mortgage.findOne({ _id: mortgageId, userId }).select(MORTGAGE_SCHEDULE_FIELDS).lean();
  if (!mortgage) {
    return;
  }
  await writeMortgageSchedule(mortgage, monthsAhead);
}

export async function ensureActiveMortgageSchedules(userId: string, monthsAhead = 24): Promise<void> {
  const mortgages = await Mortgage.find({ userId, status: "active" }).select(MORTGAGE_SCHEDULE_FIELDS).lean();
  if (!mortgages.length) {
    return;
  }
  await Promise.all(mortgages.map((mortgage) => writeMortgageSchedule(mortgage, monthsAhead)));
}
