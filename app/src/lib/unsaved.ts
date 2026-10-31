// "Did the owner type something here that nothing has taken yet?" It is asked before a page in the sheet is closed.
// A text field counts as unsaved when it has text and the owner typed in it AFTER the last action inside the sheet. An action is a press of a button (Send, Save, Add...)
// or Enter: they take the text, or the page keeps it. So a box the owner filled in and saved, and then left alone, does not ask; typing a new line in it afterwards does.
// It cannot know what a button really did; it only knows that the owner pressed one after typing. The sheet (components/Sheet.tsx) feeds it and asks the question.
export type TextField = { value: string };

export class Typed {
  private seq = 0;
  private lastAction = 0;
  private at = new WeakMap<object, number>();

  /** the owner typed in this field */
  typed(field: object) { this.at.set(field, ++this.seq); }
  /** the owner pressed a button (not a way out of the sheet) or Enter */
  acted() { this.lastAction = ++this.seq; }
  /** has any of these fields text typed since the last action? */
  unsaved(fields: Iterable<TextField>): boolean {
    for (const f of fields) if ((this.at.get(f) ?? 0) > this.lastAction && f.value.trim() !== "") return true;
    return false;
  }
}
