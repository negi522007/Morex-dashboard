// DI token for the aggregated list of registered ServiceProvider instances.
// See about.module.ts for where it's provided, and service-provider.interface.ts
// for the contract each service (weather, github, rss, ...) implements.
export const SERVICE_PROVIDERS = 'SERVICE_PROVIDERS';
