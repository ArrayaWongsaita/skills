import { A, B, C, Cells, Cover, Deck, Error as ErrorSlide, Example, Explain, Focus, Anatomy, Sources, Summary, Topic } from '../components';
import { Strip } from '../visuals/part-01';
import { listings, meta, outputs } from './part-01.data';

const T = 'Sorting';

export default function Part01() {
  return (
    <Deck meta={meta} diagrams={{}} listings={listings} outputs={outputs}>
      <Cover id="1-001" section="Opening" title={<>Sorting a list</>} body={<>Put names in order with one call</>} />
      <Focus id="1-002" section="Opening" title={<>By the end you can order any list of words</>} body={<>You will call one method and read what it gives back.</>} />
      <Topic id="1-003" section={T} title={<>sort()</>} body={<>Put a list in order</>} visual={<Strip values={['b', 'a', 'c']} />} />
      <Explain id="1-004" section={T} phase="know" title={<>A list can be put in order</>} body={<>Three names in a row: <B>sort</B> moves them so they read from A to Z.</>} visual={<Cells cells={['mia', 'al', 'zed']} highlight={1} />} />
      <Explain id="1-005" section={T} phase="parts" title={<>The list is changed in place</>} body={<>The same list ends up in order; no new list is made.</>} visual={<Strip values={['al', 'mia', 'zed']} mark={0} />} />
      <Anatomy
        id="1-006"
        section={T}
        phase="parts"
        title={<>One call, two pieces</>}
        pieces={[{ text: 'names', n: 1 }, { text: '.' }, { text: 'sort()', n: 2 }]}
        items={[<>the list to order</>, <>the call that orders it</>]}
      />
      <Example id="1-007" section={T} phase="example" title={<>Sort three names</>} body={<>Run it, then print the list.</>} snippet="sort" highlight={[[2, 2]]} />
      <ErrorSlide id="1-008" section={T} phase="watchout" title={<>Printing the call shows nothing useful</>} cause={<><C>sort()</C> returns nothing.</>} fix={<>Print the list itself, after the call.</>} />
      <Summary id="1-009" section="Closing" title={<>What you can do now</>} items={[<>Order a list with <C>sort()</C></>]} />
      <Sources id="1-010" section="Closing" title={<>Sources</>} items={[<A href="https://example.org/sorting">Sorting, an example page</A>]} />
    </Deck>
  );
}
