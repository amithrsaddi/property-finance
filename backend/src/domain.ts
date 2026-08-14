import { Mortgage, MortgagePayment, RentPayment } from "./models.js";
import { todayIso } from "./dates.js";

export async function refreshRentStatuses(userId?: string): Promise<void> {
  const today = todayIso();
  const filter: Record<string, unknown> = {
    status: { $nin: ["paid"] }
  };
  if (userId) {
    filter.userId = userId;
  }

  const rows = await RentPayment.find(filter);
  await Promise.all(
    rows.map(async (row) => {
      // Do not infer "paid" from amountReceived here — that overwrites an explicit
      // unpaid/upcoming status right after the user saves an edit, then lists again.
      // Paid is set via create/update (and Mark paid). Only auto-age overdue upcoming.
      let status = row.status;
      if (row.status === "upcoming" && row.expectedPaymentDate < today) {
        status = "unpaid";
      } else if (["late", "missed", "partially_paid"].includes(row.status)) {
        status = "unpaid";
      }
      if (status !== row.status) {
        row.status = status;
        await row.save();
      }
    })
  );
}

export async function refreshMortgagePaymentStatuses(userId?: string): Promise<void> {
  const today = todayIso();
  const filter: Record<string, unknown> = {
    status: { $nin: ["paid", "partial"] }
  };
  if (userId) {
    filter.userId = userId;
  }

  const rows = await MortgagePayment.find(filter);
  await Promise.all(
    rows.map(async (row) => {
      // Do not infer paid/partial from amountPaid here — that overwrites an explicit
      // upcoming/overdue status right after the user saves an edit, then lists again.
      // Paid/partial is set via update (and Mark paid). Only auto-age overdue upcoming.
      let status = row.status;
      if (row.status === "upcoming" && row.dueDate < today) {
        status = "overdue";
      }
      if (status !== row.status) {
        row.status = status;
        await row.save();
      }
    })
  );
}

export async function ensureMortgageSchedule(
  mortgageId: string,
  userId: string,
  monthsAhead = 24
): Promise<void> {
  const mortgage = await Mortgage.findOne({ _id: mortgageId, userId });
  if (!mortgage || mortgage.status !== "active") {
    return;
  }

  const start = new Date(`${mortgage.startDate}T00:00:00.000Z`);
  const now = new Date();
  const historyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
  const cursorStart = start > historyStart ? start : historyStart;

  const endLimit = mortgage.endDate
    ? new Date(`${mortgage.endDate}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, mortgage.paymentDay));

  const horizon = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, mortgage.paymentDay)
  );
  const finalDate = endLimit < horizon ? endLimit : horizon;

  let year = cursorStart.getUTCFullYear();
  let month = cursorStart.getUTCMonth();
  const safety = monthsAhead + 18;
  const ops = [];

  for (let i = 0; i < safety; i += 1) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(Math.max(mortgage.paymentDay, 1), lastDay);
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
