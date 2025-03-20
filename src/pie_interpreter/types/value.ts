import { bindFree, Context } from "../utils/context";
import * as C from "./core";
import { Environment } from "../utils/environment";
import * as N from "./neutral";
import { Closure } from "./utils";
import { fresh } from "./utils";
import { readBack } from "../evaluator/utils";

/*
    ## Values ##
    
    In order to type check Pie, it is necessary to find the normal
    forms of expressions and compare them with each other. The normal
    form of an expression is determined by its type - types that have
    η-rules (such as Π, Σ, Trivial, and Absurd) impose requirements on
    the normal form. For instance, every normal function has λ at the
    top, and every normal pair has cons at the top.

    Finding normal forms has two steps: first, programs are evaluated,
    much as they are with the Scheme interpreter at the end of The
    Little Schemer. Then, these values are "read back" into the syntax
    of their normal forms. This happens in normalize.rkt. This file
    defines the values that expressions can have. Structures or symbols
    that represent values are written with prefix V_.

    Laziness is implemented by allowing values to be a closure that
    does not bind a variable. It is described in normalize.rkt (search
    for "Call-by-need").
*/

export abstract class Value {

  /*
  now demands the _actual_ value represented by a DELAY. If the value
  is a DELAY-CLOS, then it is computed using undelay. If it is
  anything else, then it has already been computed, so it is
  returned.
  
  now should be used any time that a value is inspected to see what
  form it has, because those situations require that the delayed
  evaluation steps be carried out.
  */
  public now(): Value {
    return this;
  }

  public abstract readBackType(context: Context): C.Core;

}

export class DelayClosure {
  env: Environment;
  expr: C.Core;

  constructor(env: Environment, expr: C.Core) {
    this.env = env;
    this.expr = expr;
  }
  /*
    undelay is used to find the value that is contained in a
    DELAY-CLOS closure by invoking the evaluator.
  */
  public undelay(): Value {
    return this.expr.valOf(this.env).now();
  }

}

export class Box<Type> {
  content: Type;

  constructor(value: Type) {
    this.content = value;
  }

  public get() {
    return this.content;
  }
  public set(value: Type) {
    this.content = value;
  }
}


export class Delay extends Value {

  constructor(public val: Box<DelayClosure | Value>) { super() }

  public now(): Value {
    const boxContent = this.val.get();
    if (boxContent instanceof DelayClosure) {
      let theValue = boxContent.undelay();
      this.val.set(theValue);
      return theValue;
    } else { // content is a Value (content instanceof Value).
      return boxContent as Value;
    }
  }

  public readBackType(context: Context): C.Core {
    return this.now().readBackType(context);
  }
}

export class Quote extends Value {
  constructor(public name: string) { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for Quote.");
  }
}

export class Add1 extends Value {
  constructor(public smaller: Value) { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for Add1.");
  }
}

export class Pi extends Value {
  constructor(
    public argName: string,
    public argType: Value,
    public resultType: Closure
  ) { super() }

  public readBackType(context: Context): C.Core {
    const Aexpr = this.argType.readBackType(context);
    const freshedName =  fresh(context, this.argName);
    const excludeNameCtx = bindFree(context, freshedName, this.argType);
    return new C.Pi(
      freshedName,
      Aexpr,
      this.resultType
        .valOfClosure(
          new Neutral(this.argType, new N.Variable(freshedName))
        )
        .readBackType(excludeNameCtx)
    );
  }
}

export class Lambda extends Value {
  constructor(
    public argName: string,
    public body: Closure
  ) { super() }
  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for Lambda.");
  }
}

export class Sigma extends Value {
  constructor(
    public carName: string,
    public carType: Value,
    public cdrType: Closure
  ) { super() }
  
  public readBackType(context: Context): C.Core {
    const Aexpr = this.carType.readBackType(context);
    const freshedName = fresh(context, this.carName);
    const excludeNameCtx = bindFree(context, freshedName, this.carType);
    return new C.Sigma(
      freshedName,
      Aexpr,
      this.cdrType
        .valOfClosure(
          new Neutral(this.carType, new N.Variable(freshedName))
        )
        .readBackType(excludeNameCtx)
    );
  }
}

export class Cons extends Value {
  constructor(
    public car: Value,
    public cdr: Value
  ) { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for Cons.");
  }
}

export class ListCons extends Value {
  constructor(
    public head: Value,
    public tail: Value
  ) { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for ListCons.");
  }
}

export class List extends Value {
  constructor(public entryType: Value) { super() }

  public readBackType(context: Context): C.Core {
    return new C.List(this.entryType.readBackType(context));
  }
}

export class Equal extends Value {
  constructor(
    public type: Value,
    public from: Value,
    public to: Value
  ) { super() }

  public readBackType(context: Context): C.Core {
    return new C.Equal(
      this.type.readBackType(context),
      readBack(context, this.type, this.from),
      readBack(context, this.type, this.to)
    );
  }
}

export class Same extends Value {
  constructor(public value: Value) { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for Same.");
  }
}

export class Vec extends Value {
  constructor(
    public entryType: Value,
    public length: Value
  ) { super() }

  public readBackType(context: Context): C.Core {
    return new C.Vec(
      this.entryType.readBackType(context),
      readBack(context, new Nat(), this.length)
    );
  }
}

export class VecCons extends Value {
  constructor(
    public head: Value,
    public tail: Value
  ) { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for VecCons.");
  }
}

export class Either extends Value {
  constructor(
    public leftType: Value,
    public rightType: Value
  ) { super() }

  public readBackType(context: Context): C.Core {
    return new C.Either(
      this.leftType.readBackType(context),
      this.rightType.readBackType(context)
    );
  }
}

export class Left extends Value {
  constructor(public value: Value) { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for Left.");
  }
}

export class Right extends Value {
  constructor(public value: Value) { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for Right.");
  }
}

export class Neutral extends Value {
  constructor(
    public type: Value,
    public neutral: N.Neutral
  ) { super() }

  public readBackType(context: Context): C.Core {
    return this.neutral.readBackNeutral(context);
  }
}

export class Universe extends Value {
  constructor() { super() }

  public readBackType(context: Context): C.Core {
    return new C.Universe();
  }
}

export class Nat extends Value {
  constructor() { super() }

  public readBackType(context: Context): C.Core {
    return new C.Nat();
  }
}

export class Zero extends Value {
  constructor() { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for Zero.");
  }
}

export class Atom extends Value {
  constructor() { super() }

  public readBackType(context: Context): C.Core {
    return new C.Atom();
  }
}

export class Trivial extends Value {
  constructor() { super() }

  public readBackType(context: Context): C.Core {
    return new C.Trivial();
  }
}

export class Sole extends Value {
  constructor() { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for Sole.");
  }
}

export class Nil extends Value {
  constructor() { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for Nil.");
  }
}

export class Absurd extends Value {
  constructor() { super() }

  public readBackType(context: Context): C.Core {
    return new C.Absurd();
  }
}

export class VecNil extends Value {
  constructor() { super() }

  public readBackType(context: Context): C.Core {
    throw new Error("No readBackType for VecNil.");
  }
}