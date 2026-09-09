/**
 * Household port — display-only implementation.
 * ADD / OUT change the X Money *display* balance in local state.
 * They never touch paper cash, never submit to a network, never place an order.
 *
 * To wire a real yield account later: replace this module. Keep the functions.
 * UI must not branch on HOUSEHOLD_TRANSFER_MODE.
 */
import { HOUSEHOLD_TRANSFER_MODE, LEDGER_SEEDS, XMONEY_SEED } from "../config.ts";

export type LedgerLine = {
  symbol: string;
  qty: number;
  geckoId: string;
};

export type XMoneyView = {
  balance: number;
  apr: number;
  thisHour: number;
  today: number;
  month: number;
  lifetime: number;
  daily: number;
  nextPayout: string;
};

export type HouseholdState = {
  mode: typeof HOUSEHOLD_TRANSFER_MODE;
  xMoney: XMoneyView;
  ledger: LedgerLine[];
};

export function defaultHousehold(): HouseholdState {
  return {
    mode: HOUSEHOLD_TRANSFER_MODE,
    xMoney: {
      balance: XMONEY_SEED.balance,
      apr: XMONEY_SEED.apr,
      thisHour: 0,
      today: 0,
      month: XMONEY_SEED.month,
      lifetime: XMONEY_SEED.lifetime,
      daily: XMONEY_SEED.balance * (XMONEY_SEED.apr / 365),
      nextPayout: XMONEY_SEED.nextPayout,
    },
    ledger: LEDGER_SEEDS.map((l) => ({ symbol: l.symbol, qty: l.qty, geckoId: l.geckoId })),
  };
}

export function deposit(state: HouseholdState, amount: number): HouseholdState {
  if (!(amount > 0) || !Number.isFinite(amount)) return state;
  const next = state.xMoney.balance + amount;
  return { ...state, xMoney: { ...state.xMoney, balance: next } };
}

export function withdraw(state: HouseholdState, amount: number): HouseholdState {
  if (!(amount > 0) || !Number.isFinite(amount)) return state;
  const next = Math.max(0, state.xMoney.balance - amount);
  return { ...state, xMoney: { ...state.xMoney, balance: next } };
}

export function accrueDisplay(state: HouseholdState, hours: number): HouseholdState {
  if (hours <= 0) return state;
  const add = state.xMoney.balance * (state.xMoney.apr / 365 / 24) * hours;
  if (add <= 0) return state;
  return {
    ...state,
    xMoney: {
      ...state.xMoney,
      balance: state.xMoney.balance + add,
      thisHour: add,
      today: state.xMoney.today + add,
      month: state.xMoney.month + add,
      lifetime: state.xMoney.lifetime + add,
      daily: state.xMoney.balance * (state.xMoney.apr / 365),
    },
  };
}

export function setLedgerQty(state: HouseholdState, symbol: string, qty: number): HouseholdState {
  const q = Number.isFinite(qty) && qty >= 0 ? qty : 0;
  return {
    ...state,
    ledger: state.ledger.map((l) => (l.symbol === symbol ? { ...l, qty: q } : l)),
  };
}
