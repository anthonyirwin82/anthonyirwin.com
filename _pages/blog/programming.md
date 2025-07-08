---
layout: blog-programming
title: "Programming Blog Posts"
permalink: /blog/tech/programming/
---
{% assign posts = site.categories.Programming %}
<ul>
{% for post in posts %}
  <li><a href="{{ post.url }}">{{ post.title }}</a></li>
{% endfor %}
</ul>