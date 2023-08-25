<script lang="ts">
  import { SKINS_COUNT } from "@/config";
  import { each } from "library/each";
  import Frame from "./Frame.svelte";
  import spriteSrc from "images/characters.png";
  import Button from "./Button.svelte";
  import { createEventDispatcher } from "svelte";

  export let selected: number | null = null;

  const dispatch = createEventDispatcher<{ changeSkin: number }>();
</script>

<p>Выберите скин</p>

<div class="skins">
  {#each each(SKINS_COUNT) as skin}
    <div
      on:mousedown={() => (selected = skin)}
      class="skin-item"
      data-select={selected === skin}
    >
      <div class="scale">
        <Frame src={spriteSrc} x={1} y={skin} />
      </div>
    </div>
  {/each}
</div>

<Button
  on:click={() => {
    selected !== null && dispatch("changeSkin", selected);
  }}>Сохранить</Button
>

<style lang="sass">
  .skins
    display: flex
    flex-wrap: wrap
    width: 40vw
    height: 20vh
    max-width: 300px
    max-height: 200px
    overflow: hidden
    overflow-y: scroll
    justify-content: space-around

    .skin-item
      width: 48px
      height: 48px
      position: relative
      display: flex
      justify-content: center
      align-items: center
      cursor: pointer

      & > .scale
        transform: scale(2.4)

      &[data-select='true']
        background-color: #999
        border-radius: 100%
</style>
