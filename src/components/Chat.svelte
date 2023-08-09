<script lang="ts">
  import { ChatEvent } from "class/ChatEvent";
  import { createEventDispatcher, onMount } from "svelte";
  import type { Player } from "../../server/class/Player";
  import { FDate } from "library/FDate";
  import { sounds } from "library/sounds";
  import { MESSAGE_LENGTH } from "config";

  let message: string = "";

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
    player: Player["chatInfo"];
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

<div class="chat">
  <div class="list">
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
    />
    <button on:click={sendMessage}>Send (Enter)</button>
  </div>
</div>

<style lang="sass">
  .chat
    display: flex
    flex-direction: column
    gap: 10px
    max-width: 300px
    height: 370px

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
