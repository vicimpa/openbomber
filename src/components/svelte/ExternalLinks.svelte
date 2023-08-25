<script lang="ts">
  import Link from "./Link.svelte";

  export let links: { href: string; name: string }[] = [];
</script>

<p>Ссылки:</p>
<ul>
  {#each links as { href, name }}
    <li>
      <Link url={href}>
        {name}
      </Link>
    </li>
  {/each}
</ul>

<style lang="sass">
ul, li
  list-style: none

ul
  padding: 5px 0
</style>
