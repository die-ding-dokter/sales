# Deployment and domain

## Frontend

The public application shell is static and contains no private sales records. The existing `CNAME` remains `sales.diedingdokter.co.za`.

1. Set GitHub Pages source to **GitHub Actions**.
2. Create a DNS CNAME for `sales` pointing to `die-ding-dokter.github.io`. Preserve existing DNS records for the website, mail and Microsoft tenant.
3. Wait for the custom-domain verification and certificate, then enforce HTTPS in Pages.
4. Push or merge the application to `main`. The Pages workflow runs tests and a production build before publishing.
5. Missing Entra/API variables leave Microsoft sign-in disabled, with a separate sample workspace available for review.

## Azure resources

`infra/main.bicep` provisions an Azure Functions v4 Node.js 22 Linux Consumption app, managed-identity host storage and a serverless Cosmos DB account in South Africa North. It disables storage shared-key access and Cosmos local-key authentication. The private deployment package is read using the function's managed identity.

Provision in an approved Azure subscription and resource group using an authorised deployment identity:

```bash
az deployment group create \
  --resource-group <RESOURCE_GROUP> \
  --template-file infra/main.bicep \
  --parameters name=<UNIQUE_LOWERCASE_PREFIX> apiClientId=<API_ID> spaClientId=<SPA_ID> marginFloor=<APPROVED_DECIMAL>
```

Supply `taxRate` only after finance confirms registration and treatment. Leaving it blank blocks quote approval. Confirm regional service availability and deployment cost against the subscription before applying. The template is source-controlled infrastructure, not evidence that resources have been deployed.

The template grants the function identity Cosmos data contributor on the sales container and the host storage roles required by Azure Functions. Record and review those scopes. Public service endpoints are protected by Microsoft Entra; private networking is a later deployment choice that requires a compatible hosting/network design.

## GitHub-to-Azure deployment identity

Create a deployment service principal with GitHub OIDC federation for this repository's **production** environment. Configure the environment's reviewer rules as required by the organisation. Do not create a reusable client secret.

Set repository/environment variables:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`, `AZURE_FUNCTIONAPP_NAME`
- `AZURE_STORAGE_ACCOUNT` from the Bicep deployment output

Grant the deployment identity only the required resource-management scope for the function and **Storage Blob Data Contributor** on its deployment container/account. Infrastructure provisioning needs separate rights to create resources and role assignments. Do not grant the runtime identity subscription administration rights.

Run **Deploy Azure API** manually after those variables and roles are configured. It validates the project, packages only runtime dependencies, uploads an immutable private ZIP named by commit SHA using Entra authentication, sets the package URL and synchronises function triggers. The workflow makes no cloud changes when the required deployment variables are absent.

Linux Consumption without a remote build requires an external deployment package. Do not replace this flow with a ZIP-push action or turn on account keys to bypass deployment configuration.

## Verify before enabling sign-in

1. Confirm role propagation for the function identity and deployment identity.
2. Confirm the API starts with no storage or Cosmos authentication errors.
3. An unauthenticated `GET /api/session` must return `401` and no sales records.
4. Run the synthetic-role checks in `ACCEPTANCE.md`, including create/update/audit persistence and concurrent edits.
5. Configure frontend public identifiers and rebuild. Confirm the API audience/client/tenant settings match the Entra applications.
6. Verify the custom domain, HTTPS, production redirect bridge and work-account login from an assigned user.

## Rollback

Frontend: revert the release commit and redeploy Pages. API: restore the previous known-good immutable `WEBSITE_RUN_FROM_PACKAGE` blob URL and synchronise triggers. Retain packages under an agreed retention policy. Database restore is a separate controlled operation; do not delete current records during code rollback.

## Official references

- [Functions identity-based connections](https://learn.microsoft.com/en-us/azure/azure-functions/manage-connections)
- [Functions deployment technologies](https://learn.microsoft.com/en-us/azure/azure-functions/functions-deployment-technologies)
- [Cosmos DB role-based access](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/security/how-to-grant-data-plane-access)
