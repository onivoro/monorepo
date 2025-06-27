import { User } from "@onivoro/axios/b2b";

export type TNameable = Pick<User, 'firstName' | 'lastName'>;