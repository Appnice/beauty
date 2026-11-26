// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Error {
      code?: string;
    }
    interface Locals {
      lang: 'pl' | 'en';
    }
    interface PageData {
      lang: 'pl' | 'en';
    }
  }
}

export {};
