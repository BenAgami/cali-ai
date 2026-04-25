export enum DayOfWeek {
  Sunday = 1,
  Monday = 2,
  Tuesday = 3,
  Wednesday = 4,
  Thursday = 5,
  Friday = 6,
  Saturday = 7,
}

export type ReminderConfig = {
  hour: number;
  minute: number;
  daysOfWeek: DayOfWeek[];
};
