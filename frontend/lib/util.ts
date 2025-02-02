import { Message } from "lib/store";
import { fetchAuthSession } from "aws-amplify/auth";
import { apiUrls } from "lib/environments";

export function ssgPagePath(path: string) {
  return process.env.NODE_ENV === "development" ? path : `${path}.html`;
}

interface Dict<T> {
  [key: string]: T;
}
export const fetchAppSync = async ({
  query,
  variables,
}: {
  query: string;
  variables?: Dict<string | number | boolean | Message[] | string[] | null | undefined>;
}) => {
  const session = await fetchAuthSession();
  const res = await fetch(apiUrls.appSync, {
    method: "POST",
    headers: session.tokens?.accessToken ? { Authorization: session.tokens.accessToken.toString() } : undefined,
    body: JSON.stringify({ query, variables }),
  });
  const resJson = await res.json();
  if (resJson.errors) {
    console.error(resJson.errors[0].message, resJson.errors);
    throw "AppSync error.";
  }
  return resJson?.data;
};
