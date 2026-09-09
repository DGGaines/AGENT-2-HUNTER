/**
 * Household port — display-only implementation.
 * ADD / OUT change the X Money *display* balance in local state.
 * They never touch paper cash, never submit to a network, never place an order.
 *
 * To wire a real yield account later: replace this module. Keep the functions.
 * UI must not branch on HOUSEHOLD_TRANSFER_MODE.
 */
import { HOUSEHOLD_TRANSFER_MODE } from "../config.ts";
import type { HouseSymbol } from "../config.ts";

export type LedgerLine = {
  symbol: HouseSymbol;
  qty: number;
};

export type XMoneyView = {
  balance: number;
  apr: number;
  thisHour: number;
  today: number;
  month: number;
  lifetime: number;
  daily: number;
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
      balance: 0,
      apr: 0.06,
      thisHour: 0,
      today: 0,
      month: 0,
      lifetime: 0,
      daily: 0,
    },
    ledger: [
      { symbol: "BTC", qty: 0 },
      { symbol: "ETH", qty: 0 },
      { symbol: "XRP", qty: 0 },
      { symbol: "XLM", qty: 0 },
      { symbol: "HBAR", qty: 0 },
    ],
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

export function setLedgerQty(
  state: HouseholdState,
  symbol: HouseSymbol,
  qty: number,
): HouseholdState {
  const q = Number.isFinite(qty) && qty >= 0 ? qty : 0;
  return {
    ...state,
    ledger: state.ledger.map((l) => (l.symbol === symbol ? { ...l, qty: q } : l)),
  };
}
