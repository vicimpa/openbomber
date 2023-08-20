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
      messages = messages.splice(0, 100);
    });
  });
</script>

<div class="chatview">
  {#each messages as { player, message, isMe, date }, id}
    {#key id}
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
    {/key}
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
      animation: hide 0.3s 3s linear forwards
      background-color: rgba(0,0,0,0.4)
      border-radius: 10px
      margin-top: 10px
      
      &[data-isme="true"]
        align-items: flex-start

      .name
        .date
          font-size: 8px

      .message
        padding: 0px 10px
        word-wrap: break-word
        word-break: break-all
</style>
