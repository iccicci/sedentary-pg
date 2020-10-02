if(! process.env.SPG) throw "Missing SPG!";

export const connection = JSON.parse(process.env.SPG);

export const wrongConnection = { host: "none.nodomain.none" };
export const wrongConnectionError = "getaddrinfo ENOTFOUND none.nodomain.none";

export async function clean(): Promise<void> {}
