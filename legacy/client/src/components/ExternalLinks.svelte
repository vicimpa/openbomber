<script lang="ts">
  import Link from "./Link.svelte";

  export let links: {
    href: string;
    name: string;
    icon?: string | undefined;
  }[] = [];
</script>

<p>Ссылки:</p>
<ul>
  {#each links as { href, name, icon }}
    <li>
      <Link url={href} {icon}>
        {name}
      </Link>
    </li>
  {/each}
</ul>

<style lang="scss">
  ul,
  li {
    list-style: none;
  }
  ul {
    padding: 5px 0;
  }
</style>
