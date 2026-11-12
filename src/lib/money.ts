// Some fonts render narrow and non-breaking spaces badly, so use regular spaces.
export const fcfa = (v: number) => v.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');

export const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
