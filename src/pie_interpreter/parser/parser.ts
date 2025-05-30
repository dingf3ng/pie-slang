import * as S from "../types/source";

import { SchemeLexer } from "../../scheme_parser/transpiler/lexer/scheme-lexer";
import { SchemeParser } from "../../scheme_parser/transpiler/parser/scheme-parser";

import { Extended, Atomic, Expression } from '../../scheme_parser/transpiler/types/nodes/scheme-node-types';
import { Location, Syntax } from "../utils/locations";
import { Location as Loc } from '../../scheme_parser/transpiler/types/location';
import { isVarName, SiteBinder, TypedBinder } from "../types/utils";

type Element = Extended.List | Atomic.Symbol | Atomic.NumericLiteral;

// ### Helper functions

function syntaxToLocation(syntax: Syntax): Location {
  return new Location(
    syntax,
    true,
  );
}

function syntaxToSiteBinder(syntax: Syntax): SiteBinder {
  return new SiteBinder(
    syntaxToLocation(syntax),
    syntax.source
  )
}

function getValue(element: Element): string {
  if (element instanceof Atomic.Symbol) {
    return element.value;
  } else if (element instanceof Atomic.NumericLiteral) {
    return element.value;
  } else if (element instanceof Extended.List) {
    return getValue(element.elements[0] as Element);
  } else {
    throw new Error('Expected a Element, but got: ' + element);
  }
}

function locationToSyntax(source: string, location: Loc): Syntax {
  return new Syntax(
    location.start,
    location.end,
    source,
  );
}

function elementToSyntax(element: Element, location: Loc): Syntax {
  return locationToSyntax(getValue(element), location);
}

// ### Parser
// The parser class is responsible for parsing the AST generated by the SchemeParser
export function schemeParse(stx: string): Extended.List[] {
  const lexer = new SchemeLexer(stx);
  const parser = new SchemeParser('', lexer.scanTokens());
  const ast: Extended.List[] = parser.parse() as Extended.List[];
  return ast;
}

export class Parser {
  public static parsePie(stx: string): S.Source {
    return Parser.parseElements(schemeParse(stx)[0]); 
  }

  public static parseElements(element: Element): S.Source {
    const parsee = getValue(element);
    if (parsee === 'U') {
      return makeU(locationToSyntax('U', element.location));
    } else if (parsee === 'the') {
      let elements = (element as Extended.List).elements;
      let loc = element.location;
      return makeThe(
        locationToSyntax('the', loc),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element)
      );
    } else if (parsee === 'Nat') {
      return makeNat(locationToSyntax('Nat', element.location));
    } else if (parsee === 'zero') {
      return makeZero(locationToSyntax('zero', element.location));
    } else if (parsee === 'add1') {
      return makeAdd1(
        locationToSyntax('add1', element.location),
        this.parseElements((element as Extended.List).elements[1] as Element)
      );
    } else if (parsee === '->' || parsee === '→') {
      let elements = (element as Extended.List).elements;
      let loc = element.location;
      return makeArrow(
        locationToSyntax('->', loc),
        [
          this.parseElements(elements[1] as Element),
          this.parseElements(elements[2] as Element),
          elements.slice(3).map((x: Expression) => this.parseElements(x as Element))
        ]
      );
    } else if (parsee === 'lambda' || parsee === 'λ') {
      let elements = (element as Extended.List).elements;
      let loc = element.location;
      let args = elements[1] as Extended.List;
      let body = elements[2] as Element;
      return makeLambda(
        locationToSyntax('λ', loc),
        args.elements.map(
          (x: Expression) =>
            syntaxToSiteBinder(
              elementToSyntax(x as Element, element.location)
            )
        ),
        this.parseElements(body)
      );
    } else if (parsee === 'Pi' || parsee === 'Π') {
      let elements = (element as Extended.List).elements;
      let args = elements[1] as Extended.List;
      let body = elements[2] as Element;

      // Get first binding pair
      let firstPair = args.elements[0] as Extended.List;
      let x0 = firstPair.elements[0] as Element;
      let A0 = firstPair.elements[1] as Element;

      // Process remaining binding pairs
      let remainingPairs = args.elements.slice(1) as Extended.List[];
      let processedPairs = remainingPairs.map(pair => {
        let x = pair.elements[0] as Element;
        let A = pair.elements[1] as Element;
        return new TypedBinder(
          syntaxToSiteBinder(elementToSyntax(x, pair.location)),
          this.parseElements(A)
        );
      });
      return makePi(
        locationToSyntax('Π', (element as Extended.List).location),
        makeTypedBinders(
          new TypedBinder(
            syntaxToSiteBinder(elementToSyntax(x0, firstPair.location)),
            this.parseElements(A0)
          ),
          processedPairs
        ),
        this.parseElements(body)
      );
    } else if (parsee === 'Sigma' || parsee === 'Σ') {
      let elements = (element as Extended.List).elements;
      let args = elements[1] as Extended.List;
      let body = elements[2] as Element;

      // Get first binding pair
      let firstPair = args.elements[0] as Extended.List;
      let x0 = firstPair.elements[0] as Element;
      let A0 = firstPair.elements[1] as Element;

      // Process remaining binding pairs
      let remainingPairs = args.elements.slice(1) as Extended.List[];
      let processedPairs = remainingPairs.map(pair => {
        let x = pair.elements[0] as Element;
        let A = pair.elements[1] as Element;
        return new TypedBinder(
          syntaxToSiteBinder(elementToSyntax(x, pair.location)),
          this.parseElements(A)
        );
      });
      return makeSigma(
        locationToSyntax('Π', (element as Extended.List).location),
        makeTypedBinders(
          new TypedBinder(
            syntaxToSiteBinder(elementToSyntax(x0, firstPair.location)),
            this.parseElements(A0)
          ),
          processedPairs
        ),
        this.parseElements(body));
    } else if (parsee === 'Pair') {
      let elements = (element as Extended.List).elements;
      return makePair(
        locationToSyntax('Pair', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element)
      );
    } else if (parsee === 'cons') {
      let elements = (element as Extended.List).elements;
      return makeCons(
        locationToSyntax('Cons', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element)
      );
    } else if (parsee === 'car') {
      return makeCar(
        locationToSyntax('car', element.location),
        this.parseElements((element as Extended.List).elements[1] as Element)
      );
    } else if (parsee === 'cdr') {
      return makeCdr(
        locationToSyntax('cdr', element.location),
        this.parseElements((element as Extended.List).elements[1] as Element)
      );
    } else if (parsee === 'which-Nat') {
      let elements = (element as Extended.List).elements;
      return makeWhichNat(
        locationToSyntax('which-Nat', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
      );
    } else if (parsee === 'iter-Nat') {
      let elements = (element as Extended.List).elements;
      return makeIterNat(
        locationToSyntax('iter-Nat', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
      );
    } else if (parsee === 'rec-Nat') {
      let elements = (element as Extended.List).elements;
      return makeRecNat(
        locationToSyntax('rec-Nat', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
      );
    } else if (parsee === 'ind-Nat') {
      let elements = (element as Extended.List).elements;
      return makeIndNat(
        locationToSyntax('ind-Nat', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
        this.parseElements(elements[4] as Element),
      );
    } else if (parsee === 'Atom') {
      return makeAtom(locationToSyntax('Atom', element.location));
    } else if (parsee === 'quote') {
      return makeQuote(
        locationToSyntax('Quote', element.location),
        getValue((element as Extended.List).elements[1] as Element)
      );
    } else if (parsee === 'Trivial') {
      return makeTrivial(locationToSyntax('Trivial', element.location));
    } else if (parsee === 'sole') {
      return makeSole(locationToSyntax('sole', element.location));
    } else if (parsee === 'List') {
      return makeList(
        locationToSyntax('List', element.location),
        this.parseElements((element as Extended.List).elements[1] as Element)
      );
    } else if (parsee === 'nil') {
      return makeNil(locationToSyntax('nil', element.location));
    } else if (parsee === '::') {
      let elements = (element as Extended.List).elements;
      return makeListCons(
        locationToSyntax('::', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
      );
    } else if (parsee === 'rec-List') {
      let elements = (element as Extended.List).elements;
      return makeRecList(
        locationToSyntax('rec-List', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
      );
    } else if (parsee === 'ind-List') {
      let elements = (element as Extended.List).elements;
      return makeIndList(
        locationToSyntax('ind-List', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
        this.parseElements(elements[4] as Element),
      );
    } else if (parsee === '=') {
      let elements = (element as Extended.List).elements;
      return makeEqual(
        locationToSyntax('=', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
      );
    } else if (parsee === 'same') {
      return makeSame(
        locationToSyntax('same', element.location),
        this.parseElements((element as Extended.List).elements[1] as Element)
      );
    } else if (parsee === 'replace') {
      let elements = (element as Extended.List).elements;
      return makeReplace(
        locationToSyntax('replace', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
      );
    } else if (parsee === 'trans') {
      let elements = (element as Extended.List).elements;
      return makeTrans(
        locationToSyntax('trans', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
      );
    } else if (parsee === 'cong') {
      let elements = (element as Extended.List).elements;
      return makeCong(
        locationToSyntax('cong', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
      );
    } else if (parsee === 'ind-=') {
      let elements = (element as Extended.List).elements;
      return makeIndEqual(
        locationToSyntax('ind-=', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
      );
    } else if (parsee === 'symm') {
      return makeSymm(
        locationToSyntax('symm', element.location),
        this.parseElements((element as Extended.List).elements[1] as Element),
      );
    } else if (parsee === 'Vec') {
      let elements = (element as Extended.List).elements;
      return makeVec(
        locationToSyntax('Vec', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
      );
    } else if (parsee === 'vecnil') {
      return makeVecNil(
        locationToSyntax('vecnil', element.location),
      );
    } else if (parsee === 'vec::') {
      let elements = (element as Extended.List).elements;
      return makeVecCons(
        locationToSyntax('vec::', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
      );
    } else if (parsee === 'head') {
      return makeHead(
        locationToSyntax('head', element.location),
        this.parseElements((element as Extended.List).elements[1] as Element),
      );
    } else if (parsee === 'tail') {
      return makeTail(
        locationToSyntax('tail', element.location),
        this.parseElements((element as Extended.List).elements[1] as Element),
      );
    } else if (parsee === 'ind-Vec') {
      let elements = (element as Extended.List).elements;
      return makeIndVec(
        locationToSyntax('ind-Vec', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
        this.parseElements(elements[4] as Element),
        this.parseElements(elements[5] as Element),
      );
    } else if (parsee === 'Either') {
      let elements = (element as Extended.List).elements;
      return makeEither(
        locationToSyntax('Either', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
      );
    } else if (parsee === 'left') {
      return makeLeft(
        locationToSyntax('left', element.location),
        this.parseElements((element as Extended.List).elements[1] as Element),
      );
    }
    else if (parsee === 'right') {
      return makeRight(
        locationToSyntax('right', element.location),
        this.parseElements((element as Extended.List).elements[1] as Element),
      );
    } else if (parsee === 'ind-Either') {
      let elements = (element as Extended.List).elements;
      return makeIndEither(
        locationToSyntax('ind-Either', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
        this.parseElements(elements[3] as Element),
        this.parseElements(elements[4] as Element),
      );
    } else if (parsee === 'Absurd') {
      return makeAbsurd(
        locationToSyntax('Absurd', element.location),
      );
    } else if (parsee === 'ind-Absurd') {
      let elements = (element as Extended.List).elements;
      return makeIndAbsurd(
        locationToSyntax('ind-Absurd', element.location),
        this.parseElements(elements[1] as Element),
        this.parseElements(elements[2] as Element),
      );
    } else if (parsee === 'TODO') {
      return makeTODO(locationToSyntax('TODO', element.location));
    } else if (element instanceof Extended.List && (element as Extended.List).elements.length > 1) {
      let elements = (element as Extended.List).elements;
      return makeApp(
        locationToSyntax('App', element.location),
        this.parseElements(elements[0] as Element),
        this.parseElements(elements[1] as Element),
        elements.slice(2).map((x: Expression) => this.parseElements(x as Element)
        )
      );
    } else if (isVarName(parsee)) {
      return makeVarRef(locationToSyntax(parsee, element.location), parsee);
    } else if (!isNaN(Number(parsee))) { // numeric literal
      return makeNatLiteral(locationToSyntax(parsee, element.location), parsee);
    }
    throw new Error('Unexpected element: ' + element);
  }
}

// ### Helper functions for parsing the AST

function makeU(stx: Syntax): S.Source {
  return new S.Universe(syntaxToLocation(stx));
}

function makeArrow(stx: Syntax, args: [S.Source, S.Source, S.Source[]]): S.Source {
  return new S.Arrow(syntaxToLocation(stx), args[0], args[1], args[2]);
}

function makeNat(stx: Syntax): S.Source {
  return new S.Nat(syntaxToLocation(stx));
}

function makeZero(stx: Syntax): S.Source {
  return new S.Zero(syntaxToLocation(stx));
}

function makeAdd1(stx: Syntax, n: S.Source): S.Source {
  return new S.Add1(syntaxToLocation(stx), n);
}

function makeLambda(stx: Syntax, binders: SiteBinder[], body: S.Source): S.Source {
  return new S.Lambda(syntaxToLocation(stx), binders, body);
}

function makePi(stx: Syntax, binders: TypedBinder[], body: S.Source): S.Source {
  return new S.Pi(syntaxToLocation(stx), binders, body);
}

function makeSigma(stx: Syntax, binders: TypedBinder[], body: S.Source): S.Source {
  return new S.Sigma(syntaxToLocation(stx), binders, body);
}

function makeTypedBinders(head: TypedBinder, tail: TypedBinder[]): TypedBinder[] {
  return [head, ...tail];
}

function makeApp(stx: Syntax, func: S.Source, arg0: S.Source, args: S.Source[]): S.Source {
  return new S.Application(syntaxToLocation(stx), func, arg0, args);
}

function makeAtom(stx: Syntax): S.Source {
  return new S.Atom(syntaxToLocation(stx));
}

function makeTrivial(stx: Syntax): S.Source {
  return new S.Trivial(syntaxToLocation(stx));
}

function makeSole(stx: Syntax): S.Source {
  return new S.Sole(syntaxToLocation(stx));
}

function makeList(stx: Syntax, type: S.Source): S.Source {
  return new S.List(syntaxToLocation(stx), type);
}

function makeVec(stx: Syntax, type: S.Source, len: S.Source): S.Source {
  return new S.Vec(syntaxToLocation(stx), type, len);
}

function makeEither(stx: Syntax, left: S.Source, right: S.Source): S.Source {
  return new S.Either(syntaxToLocation(stx), left, right);
}

function makeNil(stx: Syntax): S.Source {
  return new S.Nil(syntaxToLocation(stx));
}

function makeVecCons(stx: Syntax, head: S.Source, tail: S.Source): S.Source {
  return new S.VecCons(syntaxToLocation(stx), head, tail);
}

function makeVecNil(stx: Syntax): S.Source {
  return new S.VecNil(syntaxToLocation(stx));
}

function makeAbsurd(stx: Syntax): S.Source {
  return new S.Absurd(syntaxToLocation(stx));
}

function makePair(stx: Syntax, head: S.Source, tail: S.Source): S.Source {
  return new S.Pair(syntaxToLocation(stx), head, tail);
}

function makeCons(stx: Syntax, head: S.Source, tail: S.Source): S.Source {
  return new S.Cons(syntaxToLocation(stx), head, tail);
}

function makeListCons(stx: Syntax, head: S.Source, tail: S.Source): S.Source {
  return new S.ListCons(syntaxToLocation(stx), head, tail);
}

function makeThe(stx: Syntax, type: S.Source, value: S.Source): S.Source {
  return new S.The(syntaxToLocation(stx), type, value);
}

function makeIndAbsurd(stx: Syntax, head: S.Source, tail: S.Source): S.Source {
  return new S.IndAbsurd(syntaxToLocation(stx), head, tail);
}

function makeTrans(stx: Syntax, from: S.Source, to: S.Source): S.Source {
  return new S.Trans(syntaxToLocation(stx), from, to);
}

function makeCong(stx: Syntax, from: S.Source, to: S.Source): S.Source {
  return new S.Cong(syntaxToLocation(stx), from, to);
}

function makeIndEqual(stx: Syntax, target: S.Source, mot: S.Source, base: S.Source): S.Source {
  return new S.IndEqual(syntaxToLocation(stx), target, mot, base);
}

function makeWhichNat(stx: Syntax, target: S.Source, base: S.Source, step: S.Source): S.Source {
  return new S.WhichNat(syntaxToLocation(stx), target, base, step);
}

function makeIterNat(stx: Syntax, target: S.Source, base: S.Source, step: S.Source): S.Source {
  return new S.IterNat(syntaxToLocation(stx), target, base, step);
}

function makeRecNat(stx: Syntax, target: S.Source, base: S.Source, step: S.Source): S.Source {
  return new S.RecNat(syntaxToLocation(stx), target, base, step);
}

function makeIndNat(stx: Syntax, target: S.Source, mot: S.Source, base: S.Source, step: S.Source): S.Source {
  return new S.IndNat(syntaxToLocation(stx), target, mot, base, step);
}

function makeRecList(stx: Syntax, target: S.Source, base: S.Source, step: S.Source): S.Source {
  return new S.RecList(syntaxToLocation(stx), target, base, step);
}

function makeIndList(stx: Syntax, target: S.Source, mot: S.Source, base: S.Source, step: S.Source): S.Source {
  return new S.IndList(syntaxToLocation(stx), target, mot, base, step);
}

function makeIndEither(stx: Syntax, target: S.Source, mot: S.Source, base: S.Source, step: S.Source): S.Source {
  return new S.IndEither(syntaxToLocation(stx), target, mot, base, step);
}

function makeIndVec(stx: Syntax, length: S.Source, target: S.Source, mot: S.Source, base: S.Source, step: S.Source): S.Source {
  return new S.IndVec(syntaxToLocation(stx), length, target, mot, base, step);
}

function makeEqual(stx: Syntax, type: S.Source, left: S.Source, right: S.Source): S.Source {
  return new S.Equal(syntaxToLocation(stx), type, left, right);
}

function makeReplace(stx: Syntax, target: S.Source, mot: S.Source, base: S.Source): S.Source {
  return new S.Replace(syntaxToLocation(stx), target, mot, base);
}

function makeSymm(stx: Syntax, equality: S.Source): S.Source {
  return new S.Symm(syntaxToLocation(stx), equality);
}

function makeHead(stx: Syntax, vec: S.Source): S.Source {
  return new S.Head(syntaxToLocation(stx), vec);
}

function makeTail(stx: Syntax, vec: S.Source): S.Source {
  return new S.Tail(syntaxToLocation(stx), vec);
}

function makeSame(stx: Syntax, type: S.Source): S.Source {
  return new S.Same(syntaxToLocation(stx), type);
}

function makeLeft(stx: Syntax, value: S.Source): S.Source {
  return new S.Left(syntaxToLocation(stx), value);
}

function makeRight(stx: Syntax, value: S.Source): S.Source {
  return new S.Right(syntaxToLocation(stx), value);
}

function makeCar(stx: Syntax, pair: S.Source): S.Source {
  return new S.Car(syntaxToLocation(stx), pair);
}

function makeCdr(stx: Syntax, pair: S.Source): S.Source {
  return new S.Cdr(syntaxToLocation(stx), pair);
}

function makeQuote(stx: Syntax, quoted: string): S.Source {
  return new S.Quote(syntaxToLocation(stx), quoted);
}

function makeVarRef(stx: Syntax, ref: string): S.Source {
  return new S.Name(syntaxToLocation(stx), ref);
}

function makeNatLiteral(stx: Syntax, num: string): S.Source {
  return new S.Number(syntaxToLocation(stx), Number(num));
}

function makeTODO(stx: Syntax): S.Source {
  return new S.TODO(syntaxToLocation(stx));
}

export class Claim {
  constructor (
    public location: Location,
    public name: string,
    public type: S.Source
  ) {}
}

export class Definition {
  constructor (
    public location: Location,
    public name: string,
    public expr: S.Source
  ) {}
}

export class SamenessCheck {
  constructor (
    public location: Location,
    public type: S.Source,
    public left: S.Source,
    public right: S.Source
  ) {}
}



export type Declaration = Claim | Definition | SamenessCheck | S.Source;


export class pieDeclarationParser {
  public static parseDeclaration(ast: Extended.List): Declaration {
    const parsee = getValue(ast);
    if (parsee === 'claim') {
      let elements = (ast as Extended.List).elements;
      return new Claim(
        syntaxToLocation(elementToSyntax(elements[0] as Element, ast.location)),
        getValue(elements[1] as Element),
        Parser.parseElements(elements[2] as Element)
      );
    } else if (parsee === 'define') {
      let elements = (ast as Extended.List).elements;
      return new Definition(
        syntaxToLocation(elementToSyntax(elements[0] as Element, ast.location)),
        getValue(elements[1] as Element),
        Parser.parseElements(elements[2] as Element)
      );
    } else if (parsee === 'check-same') {
      let elements = (ast as Extended.List).elements;
      return new SamenessCheck(
        syntaxToLocation(elementToSyntax(elements[0] as Element, ast.location)),
        Parser.parseElements(elements[1] as Element),
        Parser.parseElements(elements[2] as Element),
        Parser.parseElements(elements[3] as Element)
      );
    } else {
      return Parser.parseElements(ast);
    }
  }
}