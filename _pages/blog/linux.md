---
layout: blog-tech
title: "Linux Blog Posts"
permalink: /blog/tech/linux/
type: Linux
---
{% assign posts = site.categories.Linux %}
<ul>
{% for post in posts %}
  <li><a href="{{ post.url }}">{{ post.title }}</a></li>
{% endfor %}
</ul>
