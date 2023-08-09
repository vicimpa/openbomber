import type { Player } from "../../server/class/Player";

export class ChatEvent extends Event {

  constructor(
    public message: string,
    public player: Player['chatInfo'],
    public isMe: boolean
  ) {
    super(ChatEvent.name);
  }

  static dispatch(message: string, player: Player['chatInfo'], isMe: boolean) {
    const event = new ChatEvent(message, player, isMe);
    dispatchEvent(event);
  }

  static subscribe(callback: (e: ChatEvent) => any) {
    return (
      addEventListener(ChatEvent.name, callback as any),
      () => { removeEventListener(ChatEvent.name, callback as any); }
    );
  }
}