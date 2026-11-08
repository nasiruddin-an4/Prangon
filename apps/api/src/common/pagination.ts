import type { Paginated, PaginationInput } from '@edumanage/shared';

export const skipTake = ({ page, pageSize }: PaginationInput) => ({ skip: (page - 1) * pageSize, take: pageSize });

export const paginated = <T>(items: T[], total: number, { page, pageSize }: PaginationInput): Paginated<T> => ({
  items,
  total,
  page,
  pageSize,
});
