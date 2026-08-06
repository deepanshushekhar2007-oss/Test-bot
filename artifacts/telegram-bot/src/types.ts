export interface SessionData {
  step: number;
  groupId: number;
  ticketId: string;
  userId: number;
  firstName: string;
  username?: string;
  commodity: string;
  buyer: string;
  seller: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  facilitator: string;
  createdAt: Date;
}

export interface CompletedTicket extends SessionData {
  // All form fields are guaranteed filled
}
