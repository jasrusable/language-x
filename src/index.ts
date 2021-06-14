import { createToken, Lexer, CstParser } from 'chevrotain';

const Identifier = createToken({ name: 'Identifier', pattern: /[a-zA-Z]\w*/ });

// Literals
const True = createToken({ name: 'True', pattern: /true/ });
const False = createToken({ name: 'False', pattern: /false/ });
const Null = createToken({ name: 'Null', pattern: /null/ });
const StringLiteral = createToken({
  name: 'StringLiteral',
  pattern: /"(:?[^\\"]|\\(:?[bfnrtv"\\/]|u[0-9a-fA-F]{4}))*"/,
});
const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/,
});

// Syntax
const Comma = createToken({ name: 'Comma', pattern: /,/ });
const OpenParen = createToken({ name: 'OpenParen', pattern: /\(/ });
const CloseParen = createToken({ name: 'CloseParen', pattern: /\)/ });
const LCurly = createToken({ name: 'LCurly', pattern: /{/ });
const RCurly = createToken({ name: 'RCurly', pattern: /}/ });
const LSquare = createToken({ name: 'LSquare', pattern: /\[/ });
const RSquare = createToken({ name: 'RSquare', pattern: /]/ });
const Colon = createToken({ name: 'Colon', pattern: /:/ });

// Functions
const Def = createToken({
  name: 'Def',
  pattern: /def/,
});
const Defn = createToken({
  name: 'Defn',
  pattern: /defn/,
});
const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

const allTokens = [
  // Functions
  Defn,
  Def,
  // Syntax
  WhiteSpace,
  OpenParen,
  CloseParen,
  Comma,
  LCurly,
  RCurly,
  LSquare,
  RSquare,
  Colon,
  // Literals
  StringLiteral,
  NumberLiteral,
  True,
  False,
  Null,
  Identifier,
];

const MainLexer = new Lexer(allTokens);

class MainParser extends CstParser {
  constructor() {
    super(allTokens);
    this.performSelfAnalysis();
  }

  public main = this.RULE('main', () => {
    this.MANY(() => {
      this.SUBRULE(this.topLevel);
    });
  });

  private topLevel = this.RULE('topLevel', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.defn) },
      { ALT: () => this.SUBRULE(this.def) },
    ]);
  });

  private object = this.RULE('object', () => {
    this.CONSUME(LCurly);
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.SUBRULE2(this.objectItem);
      },
    });
    this.CONSUME(RCurly);
  });

  private objectItem = this.RULE('objectItem', () => {
    this.CONSUME(StringLiteral);
    this.CONSUME(Colon);
    this.SUBRULE(this.value);
  });

  private array = this.RULE('array', () => {
    this.CONSUME(LSquare);
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.OR([
          { ALT: () => this.SUBRULE(this.value) },
          { ALT: () => this.CONSUME(Identifier) },
        ]);
      },
    });
    this.CONSUME(RSquare);
  });

  private value = this.RULE('value', () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.SUBRULE(this.object) },
      { ALT: () => this.SUBRULE(this.array) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
      { ALT: () => this.CONSUME(Null) },
    ]);
  });

  private def = this.RULE('def', () => {
    this.CONSUME(Def);
    this.CONSUME(OpenParen);
    this.CONSUME(Identifier);
    this.CONSUME(Comma);
    this.SUBRULE(this.value);
    this.CONSUME(CloseParen);
  });

  private defn = this.RULE('defn', () => {
    this.CONSUME(Defn);
    this.CONSUME(OpenParen);
    this.CONSUME(Identifier);
    this.CONSUME(Comma);
    this.SUBRULE(this.array);
    this.CONSUME1(Comma);
    this.CONSUME(LCurly);
    this.SUBRULE(this.topLevel);
    this.CONSUME(RCurly);
    this.CONSUME(CloseParen);
  });
}

const mainParser = new MainParser();

const BaseSQLVisitor = mainParser.getBaseCstVisitorConstructor();

class MainAstVisitor extends BaseSQLVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }
  object(ctx: any) {
    return {
      type: 'object',
    };
  }

  objectItem(ctx: any) {
    return {
      type: 'objectItem',
    };
  }

  array(ctx: any) {
    return {
      type: 'array',
    };
  }

  value(ctx: any) {
    return {
      type: 'array',
    };
  }

  defn(ctx: any) {
    const identifier = ctx['Identifier'][0].image;
    const params = ctx['array'][0].children['Identifier'].map(
      (identifier: any) => identifier.image,
    );
    const topLevel = ctx['topLevel'];
    const body = this.visit(topLevel);
    return `const ${identifier} = (${params.join(',')}) => {\n${body}\n};`;
  }

  def(ctx: any) {
    const identifier = ctx['Identifier'][0].image;
    const value = ctx['value'][0].children['StringLiteral'][0].image;
    return `const ${identifier} = ${value};`;
  }

  topLevel(ctx: any) {
    const defs = ctx.def?.map((def: any) => this.visit(def)) || [];
    const defns = ctx.defn?.map((defn: any) => this.visit(defn)) || [];
    return [...defs, ...defns].join('\n');
  }

  main(ctx: any) {
    const all = ctx['topLevel'].map((topLevel: any) => this.visit(topLevel));
    return all.join('\n');
  }
}

const toAstVisitorInstance = new MainAstVisitor();

export const compile = (code: string) => {
  const lexingResult = MainLexer.tokenize(code);

  mainParser.input = lexingResult.tokens;
  const cst = mainParser.main();

  if (mainParser.errors.length > 0) {
    console.log(mainParser.errors);
    throw new Error('sad sad panda, Parsing errors detected');
  }

  const ast = toAstVisitorInstance.visit(cst);

  return ast;
};
