import { defineRailway, github, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  const AgriGuard = service("AgriGuard", {
    source: github("Uttejnagasaisamgoju/AgriGuard", { commitSha: "81a9473588b68d4e0b8b89f8e0cea30aac449f03", rootDirectory: "/", upstreamUrl: "https://github.com/Uttejnagasaisamgoju/AgriGuard" }),
    replicas: { "sfo": 1 },
    networking: { privateNetworkEndpoint: "agriguard" },
    env: { DATABASE_URL: preserve(), JWT_SECRET_KEY: preserve(), PUBLIC_URL: preserve(), SMTP_HOST: preserve(), SMTP_PORT: preserve() },
  });

  return project("beneficial-recreation", {
    resources: [AgriGuard],
  });
});
