---
title: The board and the ticket tools
kind: starter
source: starter
---
# The board and the ticket tools

## The columns
Backlog, Ready, In progress, Review, Done. A card can also be flagged "Waiting on you".

## Tickets are files
Each ticket is a plain text file in the project's hidden `.kona/tickets` folder. You can read, edit and back them up without Kona.

## Agents can raise and update tickets
Every Kona session gets a small tool server for the board. Claude can list, read, create and update tickets. It can move a card up to Review, never to Done, and never delete one. The history records which session and role made each change.

## You decide
Only you move a card to Done. Dragging a card to In progress does not start a session; press Start session on the card, which makes the branch and the copy first. See [[tickets-and-worktrees]].
