import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [filteredCollectionItems, setFilteredCollectionItems] =
    useState<Element[]>();
  const [unfilteredCollectionItems, setUnfilteredCollectionItems] =
    useState<Element[]>();
  // sortField options: averageScore, alphabetical
  const [sortField, setSortField] = useState<string>("averageScore");

  const defaultUsernames = [
    // whatischoam,marvndrums,outshine
    "whatischoam",
    "marvndrums",
    "outshine",
  ];
  const queryParams = new URLSearchParams(window.location.search);
  const usernamesCsv = queryParams.get("u");
  const usernames = usernamesCsv ? usernamesCsv.split(",") : defaultUsernames;

  // Kick off the initial page load data fetch.  Performed once ever.
  useEffect(() => {
    onGetBggClicked();
  }, []); // <-- empty dependency array

  function onGetBggClicked() {
    console.log("Querying BGG....");

    const collections: string[] = [];
    usernames.forEach((username: string) => {
      collections.push(getBggCollection(username));
    });
    const mergedDocument = mergeCollections(collections);
    console.log(new XMLSerializer().serializeToString(mergedDocument));

    const mergedNodeList = mergedDocument.querySelectorAll("item");
    const sortedItems: Element[] = [...(mergedNodeList as Element[])];
    ApplySort(sortedItems, sortField);

    setUnfilteredCollectionItems([...sortedItems]);
    setFilteredCollectionItems([...sortedItems]);
  }

  function getBggCollection(username: string): string {
    const req = new XMLHttpRequest();
    const root = "https://www.boardgamegeek.com/";
    const collectionPart =
      "/xmlapi2/collection?own=1&stats=1&username=" + username;
    const url = root + collectionPart;
    console.log("Querying collection at " + url);
    req.open("GET", url, false);
    req.send(null);
    req.responseXML?.querySelectorAll("item").forEach((item) => {
      item.setAttribute("owner", username);
    });
    if (req.responseXML) {
      return new XMLSerializer().serializeToString(req.responseXML);
    }
    return "";
  }

  //
  // Merge collections
  //
  function mergeCollections(collections: string[]): XMLDocument {
    const mergedDocument = document.implementation.createDocument(
      null,
      "items",
    );
    const itemMap = new Map<string, Element>();

    for (const xmlString of collections) {
      const source = new DOMParser().parseFromString(xmlString, "text/xml");
      const members = source.querySelectorAll("items > item");
      members.forEach((newItem) => {
        const itemName = newItem.querySelector("name")?.textContent || "";
        if (itemMap.has(itemName)) {
          const existingItem = itemMap.get(itemName);
          const existingOwner = existingItem?.getAttribute("owner");
          const newOwner = existingOwner + ", " + newItem.getAttribute("owner");
          existingItem?.setAttribute("owner", newOwner);
        } else {
          mergedDocument.documentElement.append(newItem);
          itemMap.set(itemName, newItem);
        }
      });
    }
    return mergedDocument;
  }

  //
  // Sort an array of Elements by the value of a child text node.
  //
  function sortNodeArrayByChildValue(
    nodeArray: Element[],
    childName: string,
    ascending = true,
  ): Element[] {
    nodeArray.sort((node1, node2) => {
      const child1 = node1.querySelector(childName);
      const child2 = node2.querySelector(childName);

      if (!child1 || !child2) {
        // Handle cases where child node is missing
        return 0; // Or throw an error if missing child is critical
      }

      const value1 = child1.textContent?.trim() || "";
      const value2 = child2.textContent?.trim() || "";

      return ascending
        ? value1.localeCompare(value2)
        : value2.localeCompare(value1);
    });
    return nodeArray;
  }

  //
  // Sort an array of Elements by an attribute of a child text node.
  //
  function sortNodeArrayByChildAttributeValue(
    nodeArray: Element[],
    childName: string,
    attributeName: string,
    ascending = true,
  ): Element[] {
    nodeArray.sort((node1, node2) => {
      const child1 = node1.querySelector(childName);
      const child2 = node2.querySelector(childName);

      if (!child1 || !child2) {
        // Handle cases where child node is missing
        return 0; // Or throw an error if missing child is critical
      }

      const value1 = child1.getAttribute(attributeName)?.trim() || "";
      const value2 = child2.getAttribute(attributeName)?.trim() || "";

      return ascending
        ? value1.localeCompare(value2)
        : value2.localeCompare(value1);
    });

    return nodeArray;
  }

  //
  // Render all list items.
  //
  function renderItems() {
    console.log("rendering");
    if (!filteredCollectionItems) {
      return;
    }
    return [...filteredCollectionItems].map(renderItem);
  }

  //
  // Event handler triggered when the sort options change.
  //
  function onSortFilterChanged(e: React.ChangeEvent<HTMLSelectElement>) {
    const newSortField = e.target.value;
    setSortField(newSortField);
    console.log(`Changing filter field to ${newSortField}`);
    setFilteredCollectionItems([
      ...ApplySort(filteredCollectionItems || [], newSortField),
    ]);
  }

  //
  // Sorts a the specified elementArray by the specified sort field.
  //
  function ApplySort(elementArray: Element[], newSortField: string): Element[] {
    console.log(`Applying sort: ${newSortField}`);
    switch (newSortField) {
      case "averageScore": {
        const scoreSort = sortNodeArrayByChildAttributeValue(
          elementArray || [],
          "average",
          "value",
          false,
        );
        return scoreSort;
      }
      case "alphabetical": {
        const nameSort = sortNodeArrayByChildValue(
          elementArray || [],
          "name",
          true,
        );
        return nameSort;
      }
    }
    return [];
  }

  //
  // Render an individual game's Element
  //
  function renderItem(item: Element) {
    const averageScoreNode = item.querySelector("stats > rating > average");
    const averageScoreValue = averageScoreNode
      ?.getAttribute("value")
      ?.substring(0, 3);
    const averageScoreLeadingDigit = averageScoreValue?.substring(0, 1);

    return (
      <li key={item.getAttribute("objectid")} className="gameitem">
        <img
          className="thumbnail"
          src={item.querySelector("thumbnail")?.textContent || ""}
        />
        <div className={`averageScore averageScore${averageScoreLeadingDigit}`}>
          {averageScoreValue}
        </div>
        {renderItemName(item)}
      </li>
    );
  }

  //
  // Renders the name of an item, including the linkified text and the list of owners.
  //
  function renderItemName(item: Element) {
    const itemId = item.getAttribute("objectid");
    const url = `https://www.boardgamegeek.com/boardgame/${itemId}`;
    const ownerName = item.getAttribute("owner");
    let ownerDisplay = "";
    if (ownerName) {
      ownerDisplay = ` (${ownerName})`;
    }
    return (
      <span>
        <a href={url} target="_blank">
          {item.querySelector("name")?.textContent}
        </a>
        {ownerDisplay}
      </span>
    );
  }

  //
  // Renders all usernames, linked to their respective BGG collection.
  //
  function renderUsernames() {
    return usernames.map(renderUsername);
  }

  //
  // Renders a specific username with link.
  // If index and array are specified, a trailing comma may be added.
  //
  function renderUsername(username: string, index = 0, arr: string[] = []) {
    const url = `https://boardgamegeek.com/collection/user/${username}`;
    const suffix = index == arr.length - 1 ? "" : ", ";
    return (
      <span>
        <a href={url}>{username}</a>
        {suffix}
      </span>
    );
  }

  //
  // Event handler for the player count select box
  //
  function onPlayerCountChanged(e: React.ChangeEvent<HTMLSelectElement>) {
    const playerCount = e.target.value;
    console.log("Changing player count to " + playerCount);
    filterByPlayerCount(parseInt(playerCount));
  }

  //
  // Filters the collection to items where the provided number of players is
  // within the bounds specified by the manufacturer.
  //
  function filterByPlayerCount(playerCount: number) {
    if (playerCount < 0) {
      // Set view to unfiltered
      setFilteredCollectionItems(
        ApplySort([...unfilteredCollectionItems], sortField),
      );
      return;
    }
    setFilteredCollectionItems(
      ApplySort(
        unfilteredCollectionItems?.filter((item: Element) =>
          isValidPlayerCount(item, playerCount),
        ),
        sortField,
      ),
    );
  }

  //
  // Return true if the game has a valid player count
  //
  function isValidPlayerCount(element: Element, playerCount: number) {
    const statsNode = element.querySelector("stats");
    const minPlayers = parseInt(statsNode?.getAttribute("minplayers") || "0");
    const maxPlayers = parseInt(statsNode?.getAttribute("maxplayers") || "0");
    const isValid = playerCount >= minPlayers && playerCount <= maxPlayers;
    // console.log(
    //   `${minPlayers} <= ${playerCount} <= ${maxPlayers} = ${isValid}`,
    // );
    return isValid;
  }

  return (
    <>
      <h1>Merged BGG Collection</h1>
      <p>Showing merged collection for {renderUsernames()}</p>
      <div>
        <button onClick={onGetBggClicked}>Reload from BGG</button>
        <select onChange={onPlayerCountChanged} defaultValue="-1">
          <option value="-1">Any number of players</option>
          <option value="1">1 Player</option>
          <option value="2">2 Players</option>
          <option value="3">3 Players</option>
          <option value="4">4 Players</option>
          <option value="5">5 Players</option>
          <option value="6">6 Players</option>
          <option value="7">7 Players</option>
          <option value="8">8 Players</option>
          <option value="8">9 Players</option>
          <option value="10">10 Players</option>
        </select>
        <select onChange={onSortFilterChanged} defaultValue={sortField}>
          <option value="averageScore">Sort by score</option>
          <option value="alphabetical">Sort by name</option>
        </select>
        <span className="gameCountLabel">
          {filteredCollectionItems?.length} Games
        </span>
        <ul>{renderItems()}</ul>
      </div>
    </>
  );
}

export default App;
