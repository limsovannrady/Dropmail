import { logger } from "./logger";

const AUTH_TOKEN = process.env.DROPMAIL_AUTH_TOKEN;

if (!AUTH_TOKEN) {
  throw new Error("DROPMAIL_AUTH_TOKEN environment variable is required");
}

const GRAPHQL_URL = `https://dropmail.me/api/graphql/${AUTH_TOKEN}`;

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    logger.error(
      { status: response.status, statusText: response.statusText },
      "DropMail API request failed",
    );
    throw new Error(`DropMail API error: ${response.status}`);
  }

  const json = (await response.json()) as {
    data?: T;
    errors?: Array<{ message: string }>;
  };

  if (json.errors && json.errors.length > 0) {
    logger.error({ errors: json.errors }, "DropMail GraphQL errors");
    throw new Error(json.errors[0].message);
  }

  if (!json.data) {
    throw new Error("No data returned from DropMail API");
  }

  return json.data;
}

export const queries = {
  introduceSession: `
    mutation {
      introduceSession {
        id
        expiresAt
        addresses {
          address
        }
      }
    }
  `,
  getSession: `
    query ($id: ID!) {
      session(id: $id) {
        id
        expiresAt
        addresses {
          address
        }
        mails {
          id
          fromAddr
          toAddr
          downloadUrl
          text
          headerSubject
          receivedAt
        }
      }
    }
  `,
  getMailContent: `
    query ($id: ID!) {
      session(id: $id) {
        mails {
          id
          fromAddr
          toAddr
          downloadUrl
          text
          headerSubject
          receivedAt
          html
        }
      }
    }
  `,
};
