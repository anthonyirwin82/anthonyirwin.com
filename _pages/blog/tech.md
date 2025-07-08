---
layout: blog-tech
title: "Technology Blog Posts"
permalink: /blog/tech/
---
{% assign posts = site.categories.Tech %}
<ul>
{% for post in posts %}
  <li><a href="{{ post.url }}">{{ post.title }}</a></li>
{% endfor %}
</ul>