<script lang="ts">
  import { ChatEvent } from "class/ChatEvent";
  import { createEventDispatcher, onMount } from "svelte";
  import { FDate } from "@/FDate";
  import { MESSAGE_LENGTH, TIMEOUT_MESSAGE } from "@/config";
  import type { TChatInfo } from "@/types";
  import Button from "./Button.svelte";
  import { onFrame } from "library/onFrame";

  let message: string = "";
  let isHide = false;
  let canSend = true;
  let lastMessage = 0;

  const format = FDate.makeFormat("hh:mm:ss DD.MM.YYYY");

  const dispatch = createEventDispatcher<{
    message: string;
  }>();

  const keydown = (e: KeyboardEvent) => {
    if (e.code === "Enter") {
      sendMessage();
    }
  };

  const sendMessage = () => {
    if (!canSend) return;
    dispatch("message", message);
    lastMessage = Date.now();
    message = "";
  };

  let messages: {
    message: string;
    player: TChatInfo;
    isMe: boolean;
    date: Date;
  }[] = [];

  onMount(() => {
    return ChatEvent.subscribe(({ player, message, isMe }) => {
      messages.unshift({ player, message, isMe, date: new Date() });
      messages = messages.splice(0, 100);
    });
  });

  onFrame(() => {
    canSend = Date.now() > lastMessage + TIMEOUT_MESSAGE;
  });
</script>

<div class="header">
  Чат:
  <Button
    on:click={() => {
      isHide = !isHide;
    }}
  >
    {isHide ? "Показать" : "Скрыть"}
  </Button>
</div>
<div class="chat">
  <div class="list" data-hide={isHide}>
    {#each messages as { player, message, isMe, date }}
      <div class="item" data-isme={isMe}>
        <div class="name">
          {player.name ?? "noname"}
          <span class="date">
            {format(date)}
          </span>
        </div>
        <div class="message">
          {message}
        </div>
      </div>
    {/each}
  </div>
  <div class="input" data-cansend={canSend}>
    <input
      data-cansend={canSend}
      maxlength={MESSAGE_LENGTH}
      bind:value={message}
      on:keydown={keydown}
      placeholder="Message"
      tabindex="-1"
    />
    <Button disabled={!canSend} on:click={sendMessage}>Send (Enter)</Button>
  </div>
</div>

<style lang="sass">
  .header
    display: flex
    justify-content: space-between

  .chat
    flex-grow: 1
    position: relative
    
    .list[data-hide="true"] .item
      filter: blur(10px)

    .list
      position: absolute
      top: 0
      left: 0
      right: 0
      bottom: 0
      display: flex
      flex-grow: 1
      overflow-y: scroll
      flex-direction: column-reverse
      gap: 20px
      padding-bottom: 30px

      .item
        display: flex
        flex-direction: column
        gap: 5px
        align-items: flex-end
        padding: 10px
        border-radius: 10px
        
        &[data-isme="true"]
          align-items: flex-start
          background-color: rgba(100,100,100,0.3)

        .name
          display: flex
          gap: 10px
          font-size: 10px
          .date
            font-size: 8px

        .message
          padding: 0px 10px
          word-wrap: break-word
          word-break: break-all

    .input
      display: flex
      position: absolute
      bottom: 0
      left: 0
      right: 0
      
      &[data-cansend="false"]
        box-shadow: 0 0 10px red

      input
        outline: none
        flex-grow: 1
</style>