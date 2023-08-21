<script lang="ts">
  import { FDate } from "@/FDate";
  import type { TChatInfo } from "@/types";
  import { ChatEvent } from "class/ChatEvent";
  import { onMount } from "svelte";

  const format = FDate.makeFormat("hh:mm:ss DD.MM.YYYY");

  let messages: {
    message: string;
    player: TChatInfo;
    isMe: boolean;
    date: Date;
  }[] = [];

  onMount(() => {
    return ChatEvent.subscribe(({ player, message, isMe }) => {
      messages.push({ player, message, isMe, date: new Date() });
      messages = messages.filter((e) => +e.date + 6000 < Date.now());
    });
  });
</script>

<div class="chatview">
  {#each messages as mess}
    <div class="item" data-isme={mess.isMe}>
      <div class="name">
        {mess.player.name ?? "noname"}
        <span class="date">
          {format(mess.date)}
        </span>
      </div>
      <div class="message">
        {mess.message}
      </div>
    </div>
  {/each}
</div>

<style lang="sass">
  @keyframes hide
    from
      max-height: 100px
      margin-top: 10px

    to
      max-height: 0px
      margin-top: 0px

  .chatview
    position: absolute
    top: 50px
    right: 50px
    display: flex
    flex-direction: column
    z-index: 10
    max-width: 250px

    .item
      overflow: hidden
      display: flex
      flex-direction: column
      align-items: flex-end
      animation: hide 1s 5s linear forwards
      background-color: rgba(0,0,0,0.4)
      backdrop-filter: blur(10px)
      -webkit-backdrop-filter: blur(10px)
      border-radius: 10px
      margin-top: 10px
      
      &[data-isme="true"]
        align-items: flex-start

      .name
        padding: 10px
        .date
          font-size: 8px
          

      .message
        padding: 10px
        padding-top: 0
        word-wrap: break-word
        word-break: break-all
</style>
