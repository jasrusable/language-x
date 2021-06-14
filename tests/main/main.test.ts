import { compile } from '../../src';

test('def compiles to const', () => {
  const xScript = `
    def(firstName, "jason")
  `;
  const ts = compile(xScript);
  expect(ts).toBe(`const firstName = "jason";`);
});

test('defn compiles to function', () => {
  const xScript = `
    defn(greet, [message], {
      def(hello, "hi")
    })
  `;
  const ts = compile(xScript);
  expect(ts).toBe(`const greet = (message) => {
const hello = "hi";
};`);
});

test('def and defn compiles to TS', () => {
  const xScript = `
    def(firstName, "jason")
    defn(greet, [message], {
      def(hello, "hi")
    })
  `;
  const ts = compile(xScript);
  expect(ts).toBe(`const firstName = "jason";
const greet = (message) => {
const hello = "hi";
};`);
});

test('multiple def and defn compiles to TS', () => {
  const xScript = `
    def(firstName, "jason")
    defn(greet, [message], {def(hello, "hi")})
    def(email, "jason@russell.com")
    def(lastName, "Russell")
    defn(meow, [message], {def(hello, "hi")})
  `;
  const ts = compile(xScript);
  expect(ts).toBe(`const firstName = "jason";
const greet = (message) => {
const hello = "hi";
};
const email = "jason@russell.com";
const lastName = "Russell";
const meow = (message) => {
const hello = "hi";
};`);
});
