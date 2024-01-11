<script lang="ts">
  import { ChatEvent } from "class/ChatEvent";
  import { createEventDispatcher, onMount } from "svelte";
  import { FDate } from "@core/FDate";
  import { MESSAGE_LENGTH, TIMEOUT_MESSAGE } from "@shared/config";
  import type { TChatInfo } from "@shared/types";
  import Button from "./Button.svelte";
  import { onFrame } from "library/onFrame";

  let message: string = "";
  let isHide = false;
  let canSend = true;
  let lastMessage = 0;

  const regex = /https?\:\/\/([\w\.\d]+\/?)+/gm;
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
    if (!message) return;
    dispatch("message", message);
    message = "";
    lastMessage = Date.now();
  };

  let messages: {
    message: string;
    player: TChatInfo;
    isMe: boolean;
    date: Date;
  }[] = [];

  const elem = document.createElement("p");

  function split(message: string) {
    let m: RegExpExecArray | null;

    let newMessage = "";

    let delta = 0;

    while ((m = regex.exec(message)) !== null) {
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      if (m) {
        const { index } = m;
        const { length } = m[0];

        const pre = message.slice(0, index - delta);
        message = message.slice(index - delta);
        delta += pre.length;
        elem.innerText = pre;
        newMessage += elem.innerText;

        const link = message.slice(index - delta, index - delta + length);
        message = message.slice(index - delta + length);
        delta += link.length;
        newMessage += `<a style="color: #999" target="_blank" href="${link}">${link}</a>`;
      }
    }

    elem.innerText = message;
    newMessage += elem.innerText;
    return newMessage;
  }

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
        <div class="message p-{player.name === '@cmd' ? 'server' : 'player'}">
          {#if player.name === "@cmd"}
            {message}
          {:else}
            {@html split(message)}
          {/if}
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
      placeholder="Сообщения"
      tabindex="-1"
    />
    <Button disabled={!canSend} on:click={sendMessage}>Send (Enter)</Button>
  </div>
</div>

<style lang="scss">
  .header {
    display: flex;
    justify-content: space-between;
  }
  .chat {
    flex-grow: 1;
    position: relative;

    .list[data-hide="true"] .item {
      filter: blur(5px);
    }
    .list {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-grow: 1;
      overflow-y: scroll;
      flex-direction: column-reverse;
      gap: 20px;
      padding-bottom: 30px;

      .item {
        display: flex;
        flex-direction: column;
        gap: 5px;
        align-items: flex-end;
        padding: 10px;
        border-radius: 10px;

        margin-right: 10px;

        &[data-isme="true"] {
          align-items: flex-start;
          background-color: rgba(100, 100, 100, 0.3);
        }
        .name {
          display: flex;
          gap: 10px;
          font-size: 10px;
          .date {
            font-size: 8px;
          }
        }
        .message {
          padding: 0px 10px;
          line-height: 16px;

          &.p-server {
            word-wrap: break-word;
            word-break: break-all;
            white-space: pre;
          }
        }
      }
    }
    .input {
      display: flex;
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;

      &[data-cansend="false"] {
        box-shadow: 0 0 10px red;
      }
      input {
        outline: none;
        flex-grow: 1;
      }
    }
  }
</style>
