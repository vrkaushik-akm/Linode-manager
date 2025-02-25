import { APIError } from '@linode/api-v4/lib/types';
import { last } from 'ramda';
import * as React from 'react';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import { compose } from 'recompose';
import Breadcrumb, { BreadcrumbProps } from 'src/components/Breadcrumb';
import Button from 'src/components/Button';
import {
  createStyles,
  Theme,
  withStyles,
  WithStyles,
} from 'src/components/core/styles';
import Grid from 'src/components/Grid';
import { lishLaunch } from 'src/features/Lish/lishUtils';
import useEditableLabelState from 'src/hooks/useEditableLabelState';
import { getAPIErrorOrDefault } from 'src/utilities/errorUtils';
import scrollErrorIntoView from 'src/utilities/scrollErrorIntoView';
import {
  LinodeDetailContext,
  withLinodeDetailContext,
} from '../linodeDetailContext';
import LinodePowerControl from '../LinodePowerControl';

type ClassNames = 'breadCrumbs' | 'controls' | 'launchButton';

const styles = (theme: Theme) =>
  createStyles({
    breadCrumbs: {
      position: 'relative',
      top: -2,
      [theme.breakpoints.down('md')]: {
        top: 10,
      },
    },
    controls: {
      position: 'relative',
      marginTop: `calc(9 - (${theme.spacing(1)} / 2))`, // 4
      [theme.breakpoints.down('md')]: {
        margin: 0,
        left: -8,
        display: 'flex',
        flexBasis: '100%',
      },
    },
    launchButton: {
      lineHeight: 1,
      '&:hover': {
        backgroundColor: 'transparent',
        textDecoration: 'underline',
      },
      '&:focus > span:first-child': {
        outline: '1px dotted #999',
      },
    },
  });

interface Props {
  breadcrumbProps?: Partial<BreadcrumbProps>;
}

type CombinedProps = Props &
  LinodeDetailContext &
  RouteComponentProps<{}> &
  WithStyles<ClassNames>;

const LinodeControls: React.FC<CombinedProps> = (props) => {
  const { classes, linode, updateLinode, breadcrumbProps } = props;

  const {
    editableLabelError,
    setEditableLabelError,
    resetEditableLabel,
  } = useEditableLabelState();

  const disabled = linode._permissions === 'read_only';

  const handleSubmitLabelChange = (label: string) => {
    return updateLinode({ label })
      .then(() => {
        resetEditableLabel();
      })
      .catch((err) => {
        const errors: APIError[] = getAPIErrorOrDefault(
          err,
          'An error occurred while updating label',
          'label'
        );
        const errorStrings: string[] = errors.map((e) => e.reason);
        setEditableLabelError(errorStrings[0]);
        scrollErrorIntoView();
        return Promise.reject(errorStrings[0]);
      });
  };

  const getLabelLink = (): string | undefined => {
    return last(location.pathname.split('/')) !== 'summary'
      ? `${linode.id}/summary`
      : undefined;
  };
  return (
    <Grid
      container
      justifyContent="space-between"
      alignItems="flex-end"
      data-qa-linode={linode.label}
    >
      <Grid item>
        <Breadcrumb
          pathname={props.location.pathname}
          firstAndLastOnly
          labelOptions={{ linkTo: getLabelLink() }}
          className={classes.breadCrumbs}
          onEditHandlers={
            !disabled
              ? {
                  editableTextTitle: linode.label,
                  onEdit: handleSubmitLabelChange,
                  onCancel: resetEditableLabel,
                  errorText: editableLabelError,
                }
              : undefined
          }
          /* Override with any custom breadcrumb props that may have been passed in */
          {...breadcrumbProps}
        />
      </Grid>
      <Grid item className={classes.controls}>
        <Button
          buttonType="secondary"
          className={classes.launchButton}
          disableFocusRipple={true}
          disableRipple={true}
          disabled={disabled}
          onClick={() => lishLaunch(linode.id)}
          aria-describedby="new-window"
          data-qa-launch-console
        >
          Launch LISH Console
        </Button>
        <LinodePowerControl
          status={linode.status}
          linodeEvents={linode._events}
          id={linode.id}
          label={linode.label}
          disabled={disabled}
          linodeConfigs={linode._configs}
        />
      </Grid>
    </Grid>
  );
};

const styled = withStyles(styles);

const enhanced = compose<CombinedProps, Props>(
  withRouter,
  withLinodeDetailContext(({ linode, updateLinode }) => ({
    linode,
    updateLinode,
    configs: linode._configs,
  })),
  styled
);

export default enhanced(LinodeControls);
