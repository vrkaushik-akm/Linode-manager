import Close from '@mui/icons-material/Close';
import Search from '@mui/icons-material/Search';
import { take } from 'ramda';
import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { components } from 'react-select';
import { compose } from 'recompose';
import IconButton from 'src/components/core/IconButton';
import EnhancedSelect, { Item } from 'src/components/EnhancedSelect/Select';
import { REFRESH_INTERVAL } from 'src/constants';
import withTypes, { WithTypesProps } from 'src/containers/types.container';
import withImages, { WithImages } from 'src/containers/withImages.container';
import withStoreSearch, {
  SearchProps,
} from 'src/features/Search/withStoreSearch';
import useAPISearch from 'src/features/Search/useAPISearch';
import useAccountManagement from 'src/hooks/useAccountManagement';
import { ReduxEntity, useReduxLoad } from 'src/hooks/useReduxLoad';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import { sendSearchBarUsedEvent } from 'src/utilities/ga';
import { debounce } from 'throttle-debounce';
import styled, { StyleProps } from './SearchBar.styles';
import SearchSuggestion from './SearchSuggestion';
import {
  useObjectStorageBuckets,
  useObjectStorageClusters,
} from 'src/queries/objectStorage';
import { useAllDomainsQuery } from 'src/queries/domains';
import { useAllVolumesQuery } from 'src/queries/volumes';
import { useAllKubernetesClustersQuery } from 'src/queries/kubernetes';

type CombinedProps = WithTypesProps &
  WithImages &
  SearchProps &
  StyleProps &
  RouteComponentProps<{}>;

const Control = (props: any) => <components.Control {...props} />;

/* The final option in the list will be the "go to search results page" link.
 * This doesn't share the same shape as the rest of the results, so should use
 * the default styling. */
const Option = (props: any) => {
  return ['redirect', 'info', 'error'].includes(props.value) ? (
    <components.Option {...props} />
  ) : (
    <SearchSuggestion {...props} />
  );
};

// Style overrides for React Select
export const selectStyles = {
  control: (base: any) => ({
    ...base,
    backgroundColor: '#f4f4f4',
    margin: 0,
    width: '100%',
    border: 0,
  }),
  input: (base: any) => ({ ...base, margin: 0, width: '100%', border: 0 }),
  selectContainer: (base: any) => ({
    ...base,
    width: '100%',
    margin: 0,
    border: 0,
  }),
  dropdownIndicator: () => ({ display: 'none' }),
  placeholder: (base: any) => ({ ...base, color: 'blue' }),
  menu: (base: any) => ({ ...base, maxWidth: '100% !important' }),
};

const searchDeps: ReduxEntity[] = ['linodes', 'nodeBalancers', 'images'];

export const SearchBar: React.FC<CombinedProps> = (props) => {
  const { classes, combinedResults, entitiesLoading, search } = props;

  const [searchText, setSearchText] = React.useState<string>('');
  const [searchActive, setSearchActive] = React.useState<boolean>(false);
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);

  const [apiResults, setAPIResults] = React.useState<any[]>([]);
  const [apiError, setAPIError] = React.useState<string | null>(null);
  const [apiSearchLoading, setAPILoading] = React.useState<boolean>(false);

  const { _isLargeAccount } = useAccountManagement();

  // Only request things if the search bar is open/active.
  const shouldMakeRequests = searchActive && !_isLargeAccount;

  const { data: objectStorageClusters } = useObjectStorageClusters(
    shouldMakeRequests
  );

  const { data: objectStorageBuckets } = useObjectStorageBuckets(
    objectStorageClusters,
    shouldMakeRequests
  );

  const { data: domains } = useAllDomainsQuery(shouldMakeRequests);

  const { data: clusters } = useAllKubernetesClustersQuery(shouldMakeRequests);

  const { data: volumes } = useAllVolumesQuery({}, {}, shouldMakeRequests);

  const { _loading } = useReduxLoad(
    searchDeps,
    REFRESH_INTERVAL,
    shouldMakeRequests
  );

  const { searchAPI } = useAPISearch();

  const _searchAPI = React.useRef(
    debounce(500, false, (_searchText: string) => {
      setAPILoading(true);
      searchAPI(_searchText)
        .then((searchResults) => {
          setAPIResults(searchResults.combinedResults);
          setAPILoading(false);
          setAPIError(null);
        })
        .catch((error) => {
          setAPIError(
            getAPIErrorOrDefault(error, 'Error loading search results')[0]
              .reason
          );
          setAPILoading(false);
        });
    })
  ).current;

  const buckets = objectStorageBuckets?.buckets || [];

  React.useEffect(() => {
    // We can't store all data for large accounts for client side search,
    // so use the API's filtering instead.
    if (_isLargeAccount) {
      _searchAPI(searchText);
    } else {
      search(searchText, buckets, domains ?? [], volumes ?? [], clusters ?? []);
    }
  }, [
    _loading,
    search,
    searchText,
    _searchAPI,
    _isLargeAccount,
    objectStorageBuckets,
    domains,
    volumes,
  ]);

  const handleSearchChange = (_searchText: string): void => {
    setSearchText(_searchText);
  };

  const toggleSearch = () => {
    setSearchActive(!searchActive);
    setMenuOpen(!menuOpen);
  };

  const onClose = () => {
    document.body.classList.remove('searchOverlay');
    setSearchActive(false);
    setMenuOpen(false);
  };

  const onOpen = () => {
    document.body.classList.add('searchOverlay');
    setSearchActive(true);
    setMenuOpen(true);
  };

  const onSelect = (item: Item) => {
    if (!item || item.label === '') {
      return;
    }

    if (item.value === 'info' || item.value === 'error') {
      return;
    }

    const text = item?.data?.searchText ?? '';

    if (item.value === 'redirect') {
      props.history.push({
        pathname: `/search`,
        search: `?query=${encodeURIComponent(text)}`,
      });
      return;
    }
    sendSearchBarUsedEvent();
    props.history.push(item.data.path);
  };

  const onKeyDown = (e: any) => {
    if (
      e.keyCode === 13 &&
      searchText !== '' &&
      (!combinedResults || combinedResults.length < 1)
    ) {
      props.history.push({
        pathname: `/search`,
        search: `?query=${encodeURIComponent(searchText)}`,
      });
      onClose();
    }
  };

  const guidanceText = () => {
    if (_isLargeAccount) {
      // This fancy stuff won't work if we're using API
      // based search; don't confuse users by displaying this.
      return undefined;
    }
    return (
      <>
        <b>By field:</b> “tag:my-app” “label:my-linode” &nbsp;&nbsp;
        <b>With operators</b>: “tag:my-app AND is:domain”
      </>
    );
  };

  /* Need to override the default RS filtering; otherwise entities whose label
   * doesn't match the search term will be automatically filtered, meaning that
   * searching by tag won't work. */
  const filterResults = () => {
    return true;
  };

  const finalOptions = createFinalOptions(
    _isLargeAccount ? apiResults : combinedResults,
    searchText,
    _loading || apiSearchLoading,
    // Ignore "Unauthorized" errors, since these will always happen on LKE
    // endpoints for restricted users. It's not really an "error" in this case.
    // We still want these users to be able to use the search feature.
    Boolean(apiError) && apiError !== 'Unauthorized'
  );

  return (
    <React.Fragment>
      <IconButton
        color="inherit"
        aria-label="open menu"
        onClick={toggleSearch}
        className={classes.navIconHide}
        size="large"
      >
        <Search />
      </IconButton>
      <div
        className={`
          ${classes.root}
          ${searchActive ? 'active' : ''}
        `}
      >
        <Search className={classes.icon} data-qa-search-icon />
        <label htmlFor="main-search" className="visually-hidden">
          Main search
        </label>
        <EnhancedSelect
          label="Main search"
          hideLabel
          blurInputOnSelect
          options={finalOptions}
          onChange={onSelect}
          onInputChange={handleSearchChange}
          onKeyDown={onKeyDown}
          placeholder={
            searchActive
              ? 'Search'
              : 'Search for Linodes, Volumes, NodeBalancers, Domains, Buckets, Tags...'
          }
          components={{ Control, Option }}
          styles={selectStyles}
          openMenuOnFocus={false}
          openMenuOnClick={false}
          filterOption={filterResults}
          isLoading={entitiesLoading}
          isClearable={false}
          isMulti={false}
          onMenuClose={onClose}
          onMenuOpen={onOpen}
          value={false}
          menuIsOpen={menuOpen}
          guidance={guidanceText()}
        />
        <IconButton
          color="inherit"
          aria-label="close menu"
          onClick={toggleSearch}
          className={classes.navIconHide}
          size="large"
        >
          <Close className={classes.close} />
        </IconButton>
      </div>
    </React.Fragment>
  );
};

export default compose<CombinedProps, {}>(
  withTypes,
  withRouter,
  withImages(),
  withStoreSearch(),
  styled
)(SearchBar) as React.ComponentType<{}>;

export const createFinalOptions = (
  results: Item[],
  searchText: string = '',
  loading: boolean = false,
  error: boolean = false
) => {
  const redirectOption = {
    value: 'redirect',
    data: {
      searchText,
    },
    label: `View search results page for "${searchText}"`,
  };

  const loadingResults = {
    value: 'info',
    label: 'Loading results...',
  };

  const searchError = {
    value: 'error',
    label: 'Error retrieving search results',
  };

  // Results aren't final as we're loading data

  if (loading) {
    return [redirectOption, loadingResults];
  }

  if (error) {
    return [searchError];
  }

  // NO RESULTS:
  if (!results || results.length === 0) {
    return [];
  }

  // LESS THAN 20 RESULTS:
  if (results.length <= 20) {
    return [redirectOption, ...results];
  }

  // MORE THAN 20 RESULTS:
  const lastOption = {
    value: 'redirect',
    data: {
      searchText,
    },
    label: `View all ${results.length} results for "${searchText}"`,
  };

  const first20Results = take(20, results);
  return [redirectOption, ...first20Results, lastOption];
};
