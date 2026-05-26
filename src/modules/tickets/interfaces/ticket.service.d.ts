export interface IPaginationOptions {
  page?: number;
  limit?: number;
}

export interface IFetchEventTicketOptions {
  skipPopulates?: string[];
  populateAll?: boolean;
  populate?: any[];
}
