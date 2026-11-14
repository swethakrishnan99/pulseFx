// Use the caller's access token so the Data API enforces row-level security.
export async function findPartnerMembership({ projectUrl, publishableKey, accessToken, userId, fetchImpl = fetch }) {
  const url = new URL("/rest/v1/partner_memberships", projectUrl);
  url.searchParams.set("select", "partner_id");
  url.searchParams.set("user_id", `eq.${userId}`);

  const response = await fetchImpl(url, {
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to read partner membership");
  }

  const memberships = await response.json();
  return memberships[0]?.partner_id ?? null;
}
