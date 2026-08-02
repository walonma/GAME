import { LegalAction, Tile, tileLabel } from "@mahjong/shared";
import { socket } from "../socket";

interface Props {
  actions: LegalAction[];
  myHand: Tile[];
}

function labelForGroup(myHand: Tile[], tileIds: string[]): string {
  return tileIds
    .map((id) => {
      const t = myHand.find((x) => x.id === id);
      return t ? tileLabel(t) : "?";
    })
    .join("");
}

const ACTION_NAME: Record<string, string> = {
  hu: "胡",
  pon: "碰",
  chi: "吃",
  kong: "槓",
  pass: "過",
};

export function ActionBar({ actions, myHand }: Props) {
  const nonDiscard = actions.filter((a) => a.type !== "discard");
  if (nonDiscard.length === 0) return null;

  return (
    <div className="action-bar">
      {nonDiscard.map((action, idx) => {
        if (action.type === "hu" || action.type === "pass") {
          return (
            <button key={idx} className={`btn btn-action ${action.type === "hu" ? "btn-hu" : ""}`} onClick={() => socket.emit("action", action)}>
              {ACTION_NAME[action.type]}
            </button>
          );
        }
        // pon / chi / kong: one button per possible tile grouping
        return action.groups.map((group, gi) => (
          <button
            key={`${idx}-${gi}`}
            className="btn btn-action"
            onClick={() => socket.emit("action", { type: action.type, tileIds: group })}
          >
            {ACTION_NAME[action.type]} {labelForGroup(myHand, group)}
          </button>
        ));
      })}
    </div>
  );
}
