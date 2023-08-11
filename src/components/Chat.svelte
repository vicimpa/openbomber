<script lang="ts">
  import { ChatEvent } from "class/ChatEvent";
  import { createEventDispatcher, onMount } from "svelte";
  import { FDate } from "library/FDate";
  import { sounds } from "library/sounds";
  import { MESSAGE_LENGTH } from "config";
  import type { TChatInfo } from "types";
  import Button from "./Button.svelte";

  let message: string = "";
  let isHide = false;

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
    dispatch("message", message);
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
      messages.push({ player, message, isMe, date: new Date() });
      messages = messages;
      sounds.message.play();
    });
  });
</script>

<div class="header">
  Чат:
  <Button
    on:mousedown={() => {
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
          {player.name}
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
  <div class="input">
    <input
      maxlength={MESSAGE_LENGTH}
      bind:value={message}
      on:keydown={keydown}
      placeholder="Message"
      tabindex="-1"
    />
    <Button on:click={sendMessage}>Send (Enter)</Button>
  </div>
</div>

<style lang="sass">
  .header
    display: flex
    justify-content: space-between
  .chat
    display: flex
    flex-direction: column
    gap: 10px
    max-width: 300px
    height: 370px

    .list[data-hide="true"] .item
      filter: blur(10px)

    .list
      overflow-y: scroll
      display: flex
      flex-grow: 1
      flex-direction: column
      justify-content: flex-end
      gap: 20px

      .item
        display: flex
        flex-direction: column
        gap: 5px
        align-items: flex-end
        
        &[data-isme="true"]
          align-items: flex-start

        .name
          .date
            font-size: 8px

        .message
          padding: 0px 10px
          word-wrap: break-word
          word-break: break-all

    .input
      display: flex
      input
        outline: none
        flex-grow: 1
</style>
